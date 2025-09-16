import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Reporte {
  id?: string;
  tipo: 'observacion' | 'alerta' | 'medicion' | 'incidente';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  titulo: string;
  descripcion: string;
  ubicacion: {
    latitud: number;
    longitud: number;
    nombre?: string;
  };
  autor: {
    nombre: string;
    email?: string;
    organizacion?: string;
  };
  fecha: Date;
  estado: 'pendiente' | 'en_revision' | 'validado' | 'rechazado';
  imagenes?: string[];
  datosAdicionales?: any;
  tags?: string[];
}

export interface FiltroReportes {
  tipo?: string;
  prioridad?: string;
  estado?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  autor?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private readonly API_BASE = 'http://localhost:8000/api';
  private reportesSubject = new BehaviorSubject<Reporte[]>([]);
  public reportes$ = this.reportesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.cargarReportes();
  }
  /**
   * Carga todos los reportes desde el backend
   */
  cargarReportes(): void {
    this.http.get<Reporte[]>(`${this.API_BASE}/reportes`).pipe(
      catchError(error => {
        console.warn('Backend no disponible, usando datos locales:', error.message);
        return of(this.getMockReportes());
      })
    ).subscribe(reportes => {
      this.reportesSubject.next(reportes);
      console.log(`📊 ${reportes.length} reportes cargados (modo local)`);
    });
  }

  /**
   * Obtiene todos los reportes
   */
  obtenerReportes(filtros?: FiltroReportes): Observable<Reporte[]> {
    return this.reportes$.pipe(
      map(reportes => this.filtrarReportes(reportes, filtros))
    );
  }

  /**
   * Crea un nuevo reporte
   */
  crearReporte(reporte: Omit<Reporte, 'id' | 'fecha' | 'estado'>): Observable<Reporte> {
    const nuevoReporte: Reporte = {
      ...reporte,
      id: this.generarId(),
      fecha: new Date(),
      estado: 'pendiente'
    };

    return this.http.post<Reporte>(`${this.API_BASE}/reportes`, nuevoReporte).pipe(
      map(reporteCreado => {
        const reportesActuales = this.reportesSubject.value;
        this.reportesSubject.next([reporteCreado, ...reportesActuales]);
        return reporteCreado;
      }),
      catchError(error => {
        console.error('Error creando reporte:', error);
        // Fallback: agregar localmente
        const reportesActuales = this.reportesSubject.value;
        this.reportesSubject.next([nuevoReporte, ...reportesActuales]);
        return of(nuevoReporte);
      })
    );
  }

  /**
   * Actualiza un reporte existente
   */
  actualizarReporte(id: string, cambios: Partial<Reporte>): Observable<Reporte> {
    return this.http.put<Reporte>(`${this.API_BASE}/reportes/${id}`, cambios).pipe(
      map(reporteActualizado => {
        const reportes = this.reportesSubject.value;
        const index = reportes.findIndex(r => r.id === id);
        if (index !== -1) {
          reportes[index] = reporteActualizado;
          this.reportesSubject.next([...reportes]);
        }
        return reporteActualizado;
      }),
      catchError(error => {
        console.error('Error actualizando reporte:', error);
        return of({} as Reporte);
      })
    );
  }

  /**
   * Elimina un reporte
   */
  eliminarReporte(id: string): Observable<boolean> {
    return this.http.delete(`${this.API_BASE}/reportes/${id}`).pipe(
      map(() => {
        const reportes = this.reportesSubject.value.filter(r => r.id !== id);
        this.reportesSubject.next(reportes);
        return true;
      }),
      catchError(error => {
        console.error('Error eliminando reporte:', error);
        return of(false);
      })
    );
  }

  /**
   * Sube imágenes para un reporte
   */
  subirImagenes(archivos: File[]): Observable<string[]> {
    const formData = new FormData();
    archivos.forEach(archivo => {
      formData.append('imagenes', archivo);
    });

    return this.http.post<{ urls: string[] }>(`${this.API_BASE}/reportes/imagenes`, formData).pipe(
      map(response => response.urls),
      catchError(error => {
        console.error('Error subiendo imágenes:', error);
        // Fallback: generar URLs mock
        return of(archivos.map(archivo => URL.createObjectURL(archivo)));
      })
    );
  }

  /**
   * Obtiene reportes por ubicación (radio en km)
   */
  obtenerReportesPorUbicacion(lat: number, lng: number, radio: number = 10): Observable<Reporte[]> {
    return this.reportes$.pipe(
      map(reportes => reportes.filter(reporte => {
        const distancia = this.calcularDistancia(
          lat, lng,
          reporte.ubicacion.latitud, reporte.ubicacion.longitud
        );
        return distancia <= radio;
      }))
    );
  }

  /**
   * Obtiene estadísticas de reportes
   */
  obtenerEstadisticas(): Observable<any> {
    return this.reportes$.pipe(
      map(reportes => ({
        total: reportes.length,
        porTipo: this.agruparPor(reportes, 'tipo'),
        porPrioridad: this.agruparPor(reportes, 'prioridad'),
        porEstado: this.agruparPor(reportes, 'estado'),
        ultimoMes: reportes.filter(r => 
          new Date(r.fecha) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length
      }))
    );
  }

  /**
   * Genera alertas automáticas basadas en reportes críticos
   */
  generarAlertasAutomaticas(): Observable<Reporte[]> {
    return this.reportes$.pipe(
      map(reportes => reportes.filter(r => 
        r.prioridad === 'critica' && 
        r.estado === 'validado' &&
        new Date(r.fecha) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
      ))
    );
  }

  /**
   * Filtra reportes según criterios
   */
  private filtrarReportes(reportes: Reporte[], filtros?: FiltroReportes): Reporte[] {
    if (!filtros) return reportes;

    return reportes.filter(reporte => {
      if (filtros.tipo && reporte.tipo !== filtros.tipo) return false;
      if (filtros.prioridad && reporte.prioridad !== filtros.prioridad) return false;
      if (filtros.estado && reporte.estado !== filtros.estado) return false;
      if (filtros.autor && !reporte.autor.nombre.toLowerCase().includes(filtros.autor.toLowerCase())) return false;
      if (filtros.fechaDesde && new Date(reporte.fecha) < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && new Date(reporte.fecha) > filtros.fechaHasta) return false;
      return true;
    });
  }

  /**
   * Calcula distancia entre dos puntos (fórmula de Haversine)
   */
  private calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLng = this.degreesToRadians(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Agrupa elementos por una propiedad
   */
  private agruparPor(array: any[], propiedad: string): any {
    return array.reduce((acc, item) => {
      const key = item[propiedad];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Genera un ID único
   */
  private generarId(): string {
    return 'rep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }
  /**
   * Datos mock para desarrollo - inicialmente vacío
   */
  private getMockReportes(): Reporte[] {
    return [];
  }
}
