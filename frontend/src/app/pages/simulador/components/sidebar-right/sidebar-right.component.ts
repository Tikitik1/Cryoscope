import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GlaciarService } from '../../services/glaciar.service';
import { ClimaService } from '../../services/clima.service';
import { LayerControlService } from '../../services/layer-control.service';
import { InformacionService, InformacionSeleccionada } from '../../services/informacion.service';
import { Iceberg } from '../../models/interfaces';
import { Subscription } from 'rxjs';

interface InformacionTemperatura {
  nombre: string;
  temperaturaPasada: number;
  temperaturaActual: number;
  temperaturaFutura: number;
  delta: number;
}

interface InformacionGlaciar {
  // Información básica
  id?: number;
  nombre: string;
  tipo: string;
  region: string;
  comuna?: string;
  cuenca: string;
  estado: string;
  codigo: string;
  
  // Información geométrica
  area_m2?: number;
  area_km2?: number;
  area_formatted: string;
  volumen_estimado_km3?: number;
  volumen_km3?: number;
  volumen_formatted: string;
  
  // Información de ubicación y geografía
  latitud?: number;
  longitud?: number;
  coordenadas_formatted: string;
  altitud_estimada?: string;
  
  // Información de altitudes específicas
  altura_media_m?: number;
  altura_maxima_m?: number;
  altura_minima_m?: number;
  
  // Información climática
  temperatura_actual?: number;
  temperatura_formatted: string;
  
  // Información adicional mejorada
  clasificacion?: string;
  frente_termina_en?: string; // Dónde termina el glaciar (tierra/agua)
  orientacion?: string; // Orientación del glaciar
  pendiente_grados?: number; // Pendiente en grados
  propiedades_shapefile?: any;
  timestamp?: string;
  
  // Para compatibilidad
  area: string;
  coordenadas: string;
}

interface InformacionPinturaRupestre {
  id?: string;
  nombre: string;
  descripcion?: string;
  fechaDescubrimiento?: string;
  estadoConservacion?: string;
  tipo?: string;
  tipo_sitio?: string;
  patrimonio?: string;
  region?: string;
  latitud?: number;
  longitud?: number;
  coordenadas_formatted?: string;
  timestamp?: string;
  propiedades_adicionales?: any;
}

interface InformacionClima {
  comuna: string;
  precipitacion: number;
  humedad: number;
  radiacion: number;
  viento_velocidad: number;
  viento_direccion: number;
  presion: number;
  uv: number;
  visibilidad: number;
  nubosidad: number;
  punto_rocio: number;
  sensacion_termica: number;
}

@Component({
  selector: 'app-sidebar-right',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-right.component.html',
  styleUrls: ['./sidebar-right.component.scss']
})
export class SidebarRightComponent implements OnInit, OnDestroy {
  icebergs: Iceberg[] = [];  // Control de capas
  capaTemperaturaActiva = true;
  capaIcebergsActiva = true;
  capaPinturasRupestresActiva = true;
  capaDEMActiva = false;
  capaClimaActiva = false;
  // Información seleccionada
  informacionTemperatura: InformacionTemperatura | null = null;
  informacionGlaciar: InformacionGlaciar | null = null;
  informacionPinturaRupestre: InformacionPinturaRupestre | null = null;
  informacionClima: InformacionClima | null = null;

  cargandoIcebergs = true;
  errorCarga: string | null = null;
  
  private subscriptions: Subscription[] = [];  constructor(
    private glaciarService: GlaciarService,
    private climaService: ClimaService,
    private layerControlService: LayerControlService,
    private informacionService: InformacionService,
    private http: HttpClient
  ) {}ngOnInit(): void {
    this.cargarIcebergs();    // Suscribirse a los cambios del estado de las capas
    const layerStateSub = this.layerControlService.layerState$.subscribe(state => {
      this.capaTemperaturaActiva = state.temperatura;
      this.capaIcebergsActiva = state.icebergs;
      this.capaPinturasRupestresActiva = state.pinturasRupestres;
      this.capaDEMActiva = state.dem;
      this.capaClimaActiva = state.clima;
    });    // Suscribirse a los cambios de información
    const informacionSub = this.informacionService.informacion$.subscribe(info => {      if (info) {
        if (info.tipo === 'temperatura') {
          this.mostrarInformacionTemperatura(info.data);
        } else if (info.tipo === 'glaciar') {
          this.mostrarInformacionGlaciar(info.data);
        } else if (info.tipo === 'pinturaRupestre') {
          this.mostrarInformacionPinturaRupestre(info.data);
        } else if (info.tipo === 'clima') {
          this.mostrarInformacionClima(info.data);
        }
      } else {
        // Solo limpiar el estado local, no llamar al servicio para evitar bucle infinito
        this.informacionTemperatura = null;
        this.informacionGlaciar = null;
        this.informacionPinturaRupestre = null;
        this.informacionClima = null;
      }
    });
    
    this.subscriptions.push(layerStateSub, informacionSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga la lista de icebergs
   */
  private cargarIcebergs(): void {
    this.cargandoIcebergs = true;
    this.errorCarga = null;

    const icebergsSub = this.glaciarService.obtenerIcebergs().subscribe({
      next: (icebergs) => {
        this.icebergs = icebergs;
        this.cargandoIcebergs = false;
      },
      error: (error) => {
        console.error('Error cargando icebergs:', error);
        this.errorCarga = 'Error cargando datos de icebergs';
        this.cargandoIcebergs = false;
      }
    });

    this.subscriptions.push(icebergsSub);  }
  /**
   * Alterna la visibilidad de la capa de temperatura
   */
  toggleTemperatura(): void {
    this.layerControlService.toggleTemperatura();
  }

  /**
   * Alterna la visibilidad de la capa de icebergs  
   */
  toggleIcebergs(): void {
    this.layerControlService.toggleIcebergs();
  }

  /**
   * Alterna la visibilidad de la capa de pinturas rupestres
   */
  togglePinturasRupestres(): void {
    this.layerControlService.togglePinturasRupestres();
  }
  /**
   * Alterna la visibilidad de la capa de DEM
   */
  toggleDEM(): void {
    console.log('🔄 Toggle DEM activado desde sidebar');
    this.layerControlService.toggleDEM();
  }

  /**
   * Alterna la visibilidad de la capa de clima
   */
  toggleClima(): void {
    console.log('🔄 Toggle Clima activado desde sidebar');
    this.layerControlService.toggleClima();
  }

  /**
   * Obtiene el ícono según el nivel de riesgo
   */
  getRiskIcon(nivel: string): string {
    switch (nivel) {
      case 'alto': return '🔴';
      case 'medio': return '🟡';
      case 'bajo': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Obtiene el ícono de impacto ecológico
   */
  getEcologyIcon(impacto: string): string {
    if (impacto.includes('marina')) return '🐟';
    if (impacto.includes('corriente')) return '🌊';
    if (impacto.includes('temperatura')) return '🌡️';
    if (impacto.includes('salinidad')) return '🧂';
    if (impacto.includes('navegación')) return '⛵';
    return '🌿';
  }  /**
   * Formatea el tamaño del iceberg
   */
  formatearTamano(tamano: number): string {
    if (tamano >= 1000000) {
      return (tamano / 1000000).toFixed(1) + ' km²';
    } else if (tamano >= 1000) {
      return (tamano / 1000).toFixed(1) + ' k m²';
    }
    return tamano.toFixed(0) + ' m²';
  }

  /**
   * Formatea las coordenadas
   */
  formatearCoordenadas(latitud: number, longitud: number): string {
    const latDir = latitud >= 0 ? 'N' : 'S';
    const lonDir = longitud >= 0 ? 'E' : 'W';
    return `${Math.abs(latitud).toFixed(2)}°${latDir}, ${Math.abs(longitud).toFixed(2)}°${lonDir}`;
  }
  /**
   * Recarga los datos de icebergs
   */
  recargarIcebergs(): void {
    this.cargarIcebergs();
  }  /**
   * Cierra la información mostrada (llamado por el usuario)
   */
  cerrarInformacion(): void {
    // Solo notificar al servicio cuando es una acción del usuario
    this.informacionService.cerrarInformacion();
  }
  /**
   * Limpia la información local sin notificar al servicio
   */
  private limpiarInformacion(): void {
    this.informacionTemperatura = null;
    this.informacionGlaciar = null;
    this.informacionPinturaRupestre = null;
  }/**
   * Muestra información de temperatura para una comuna
   */
  mostrarInformacionTemperatura(data: any): void {
    this.informacionGlaciar = null; // Cerrar info de glaciar si está abierta
    
    console.log('📊 Mostrando información de temperatura:', data);
    
    // Los datos ya vienen completos del endpoint /api/temperatura/comunas/completo
    this.informacionTemperatura = {
      nombre: data.nombre || data.NOM_COMUNA || 'Comuna',
      temperaturaPasada: data.temperatura_2020 || data.temperatura || 0,
      temperaturaActual: data.temperatura_actual || data.temperaturaActual || 0,
      temperaturaFutura: data.temperatura_2050 || 0,
      delta: data.delta_temperatura || 0
    };
    
    console.log('🌡️ Información de temperatura configurada:', this.informacionTemperatura);
  }  /**
   * Muestra información completa de glaciar con datos optimizados
   */
  mostrarInformacionGlaciar(data: any): void {
    this.informacionTemperatura = null; // Cerrar info de temperatura si está abierta
    
    console.log('🏔️ Mostrando información de glaciar:', data);
    
    // Si los datos vienen de un iceberg con datosCompletos, usar esos datos
    const datosGlaciar = data.datosCompletos || data;
    
    this.informacionGlaciar = {
      // Información básica
      id: datosGlaciar.id || data.id,
      nombre: datosGlaciar.nombre || data.nombre || 'Sin Nombre',
      tipo: datosGlaciar.clasificacion || data.clasificacion || data.tipo || 'Glaciar',
      region: datosGlaciar.region || data.region || 'Aysén del Gral. Carlos Ibáñez del Campo',
      comuna: datosGlaciar.comuna || data.comuna,
      cuenca: '', // Eliminado para no mostrar
      estado: 'Activo', // Asumir activo por defecto
      codigo: datosGlaciar.codigo || data.codigo || data.id || '',
      
      // Información geométrica mejorada
      area_m2: datosGlaciar.area_km2 ? datosGlaciar.area_km2 * 1000000 : 0,
      area_km2: datosGlaciar.area_km2 || 0,
      area_formatted: this.formatearArea((datosGlaciar.area_km2 || 0) * 1000000),
      volumen_estimado_km3: datosGlaciar.volumen_km3 || 0,
      volumen_km3: datosGlaciar.volumen_km3 || 0,
      volumen_formatted: this.formatearVolumen(datosGlaciar.volumen_km3 || 0),
      
      // Información de ubicación y altitudes específicas
      latitud: datosGlaciar.latitud,
      longitud: datosGlaciar.longitud,
      coordenadas_formatted: this.formatearCoordenadas(datosGlaciar.latitud || 0, datosGlaciar.longitud || 0),
      altitud_estimada: this.formatearAltitudes(datosGlaciar),
      altura_media_m: datosGlaciar.altura_media_m,
      altura_maxima_m: datosGlaciar.altura_maxima_m,
      altura_minima_m: datosGlaciar.altura_minima_m,
      
      // Información climática - eliminada para no mostrar
      temperatura_actual: undefined,
      temperatura_formatted: '',
      
      // Información adicional mejorada
      clasificacion: datosGlaciar.clasificacion || 'No clasificado',
      frente_termina_en: datosGlaciar.frente_termina_en || '', // Nueva info importante
      orientacion: datosGlaciar.orientacion !== 'N/A' && datosGlaciar.orientacion !== 'No especificado' ? datosGlaciar.orientacion : '',
      pendiente_grados: datosGlaciar.pendiente_grados || null,
      propiedades_shapefile: null, // Eliminado para no mostrar datos adicionales
      timestamp: new Date().toISOString(),
      
      // Para compatibilidad con el template existente
      area: this.formatearArea((datosGlaciar.area_km2 || 0) * 1000000),
      coordenadas: this.formatearCoordenadas(datosGlaciar.latitud || 0, datosGlaciar.longitud || 0)
    };
    
    console.log('🏔️ Información de glaciar configurada:', this.informacionGlaciar);
  }

  /**
   * Formatea las altitudes de manera útil
   */
  private formatearAltitudes(data: any): string {
    const alturas = [];
    
    if (data.altura_media_m) {
      alturas.push(`Media: ${data.altura_media_m}m`);
    }
    if (data.altura_maxima_m) {
      alturas.push(`Máx: ${data.altura_maxima_m}m`);
    }
    if (data.altura_minima_m) {
      alturas.push(`Mín: ${data.altura_minima_m}m`);
    }
    
    return alturas.length > 0 ? alturas.join(', ') : 'Variable';
  }

  /**
   * Formatea el área en unidades apropiadas
   */
  private formatearArea(area: number): string {
    if (area >= 1000000) {
      return `${(area / 1000000).toFixed(2)} km²`;
    } else if (area > 0) {
      return `${area.toFixed(0)} m²`;
    }
    return 'No especificada';
  }

  /**
   * Formatea el volumen en unidades apropiadas
   */
  private formatearVolumen(volumen: number): string {
    if (volumen >= 1) {
      return `${volumen.toFixed(2)} km³`;
    } else if (volumen > 0) {
      return `${(volumen * 1000).toFixed(0)} m³`;
    }
    return 'No estimado';
  }

  /**
   * Obtiene las claves de un objeto (helper para el template)
   */
  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }
  /**
   * Verifica si la temperatura es fría
   */
  isTemperatureCold(temp: number | null | undefined): boolean {
    return temp !== null && temp !== undefined && temp < 0;
  }

  /**
   * Verifica si la temperatura es fresca
   */
  isTemperatureCool(temp: number | null | undefined): boolean {
    return temp !== null && temp !== undefined && temp >= 0 && temp < 5;
  }

  /**
   * Verifica si la temperatura es cálida
   */
  isTemperatureWarm(temp: number | null | undefined): boolean {
    return temp !== null && temp !== undefined && temp >= 5;
  }

  /**
   * Verifica si hay datos de altitud disponibles
   */
  hasAltitudeData(): boolean {
    return !!(this.informacionGlaciar?.altura_media_m || 
              this.informacionGlaciar?.altura_maxima_m || 
              this.informacionGlaciar?.altura_minima_m);
  }

  /**
   * Muestra información de pintura rupestre
   */
  mostrarInformacionPinturaRupestre(data: any): void {
    this.informacionTemperatura = null; // Cerrar info de temperatura si está abierta
    this.informacionGlaciar = null; // Cerrar info de glaciar si está abierta
    
    console.log('🎨 Mostrando información de pintura rupestre:', data);
    
    this.informacionPinturaRupestre = {
      nombre: data.nombre || data.NOMBRE || data.Name || 'Sitio Rupestre',
      tipo_sitio: data.tipo_sitio || 'Pintura Rupestre',
      region: data.region || 'Aysén del Gral. Carlos Ibáñez del Campo',
      latitud: data.latitud,
      longitud: data.longitud,
      coordenadas_formatted: this.formatearCoordenadas(data.latitud || 0, data.longitud || 0),
      patrimonio: data.patrimonio || 'Cultural',
      timestamp: new Date().toISOString(),
      propiedades_adicionales: data
    };
    
    console.log('🎨 Información de pintura rupestre configurada:', this.informacionPinturaRupestre);
  }

  /**
   * Muestra información de clima en el panel
   */
  private mostrarInformacionClima(data: any): void {
    // Limpiar otras informaciones
    this.informacionTemperatura = null;
    this.informacionGlaciar = null;
    this.informacionPinturaRupestre = null;
    
    this.informacionClima = {
      comuna: data.comuna,
      precipitacion: data.precipitacion,
      humedad: data.humedad,
      radiacion: data.radiacion,
      viento_velocidad: data.viento_velocidad,
      viento_direccion: data.viento_direccion,
      presion: data.presion,
      uv: data.uv,
      visibilidad: data.visibilidad,
      nubosidad: data.nubosidad,
      punto_rocio: data.punto_rocio,
      sensacion_termica: data.sensacion_termica
    };
  }
}
