import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OpenMeteoService, DatosMeteorologicos, Alerta } from '../../services/open-meteo.service';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-monitoreo-tiempo-real',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="monitoreo-container">
      <div class="header">
        <h3>
          <i class="fas fa-satellite-dish"></i>
          Monitoreo Meteorológico en Tiempo Real
        </h3>
        <div class="controles">
          <button *ngIf="!monitoreoActivo" (click)="iniciarMonitoreo()" class="btn-iniciar">
            <i class="fas fa-play"></i>
            Iniciar Monitoreo
          </button>
          <button *ngIf="monitoreoActivo" (click)="detenerMonitoreo()" class="btn-detener">
            <i class="fas fa-stop"></i>
            Detener Monitoreo
          </button>
        </div>
      </div>

      <div class="estado-sistema">
        <div class="indicador" [class]="monitoreoActivo ? 'conectado' : 'desconectado'">
          <div class="punto-estado"></div>
          {{ monitoreoActivo ? 'Conectado' : 'Desconectado' }}
        </div>
        <div class="ultima-actualizacion" *ngIf="ultimaActualizacion">
          <i class="fas fa-clock"></i>
          {{ ultimaActualizacion | date:'HH:mm:ss' }}
        </div>
      </div>

      <div class="resumen-alertas" *ngIf="monitoreoActivo">
        <div class="estadistica">
          <div class="icono-temp">🌡️</div>
          <div class="valor">{{ temperaturaPromedio | number:'1.1-1' }}°C</div>
          <div class="label">Temp. Promedio</div>
        </div>
        <div class="estadistica alerta">
          <div class="icono-alerta">⚠️</div>
          <div class="valor">{{ totalAlertas }}</div>
          <div class="label">Alertas Activas</div>
        </div>
        <div class="estadistica">
          <div class="icono-ubicacion">📍</div>
          <div class="valor">{{ datosGlaciares.length }}</div>
          <div class="label">Ubicaciones</div>
        </div>
        <div class="estadistica">
          <div class="icono-tiempo">🔄</div>
          <div class="valor">Ahora</div>
          <div class="label">Última Act.</div>
        </div>
      </div>

      <div class="datos-glaciares" *ngIf="monitoreoActivo && datosGlaciares.length > 0">
        <div *ngFor="let datos of datosGlaciares" class="tarjeta-glaciar">
          <div class="info-ubicacion">
            <h4>{{ datos.ubicacion.nombre }}</h4>
            <small>{{ datos.ubicacion.latitud | number:'1.4-4' }}°, {{ datos.ubicacion.longitud | number:'1.4-4' }}°</small>
          </div>

          <div class="parametros-principales">
            <div class="temperatura-principal">
              <span class="valor-temp">{{ datos.temperatura | number:'1.1-1' }}°C</span>
              <div class="rango-temp">
                <small>{{ datos.temperaturaMinima | number:'1.1-1' }}° / {{ datos.temperaturaMaxima | number:'1.1-1' }}°</small>
              </div>
            </div>

            <div class="parametros-grid">
              <div class="parametro">
                <i class="fas fa-cloud-rain"></i>
                <div class="valor">{{ datos.precipitacion | number:'1.1-1' }} mm/h</div>
              </div>
              <div class="parametro">
                <i class="fas fa-wind"></i>
                <div class="valor">{{ datos.velocidadViento | number:'1.1-1' }} km/h</div>
              </div>
              <div class="parametro">
                <i class="fas fa-tint"></i>
                <div class="valor">{{ datos.humedad }}%</div>
              </div>
              <div class="parametro">
                <i class="fas fa-thermometer-empty"></i>
                <div class="valor">{{ datos.presionAtmosferica }} hPa</div>
              </div>
            </div>
          </div>

          <div class="indicador-riesgo" [class]="getNivelRiesgo(datos)">
            <span>Riesgo: {{ getNivelRiesgoTexto(datos) }}</span>
            <div class="porcentaje-riesgo">{{ getPorcentajeRiesgo(datos) }}%</div>
          </div>

          <div class="timestamp-datos">
            <small>{{ datos.timestamp | date:'HH:mm:ss' }}</small>
          </div>
        </div>
      </div>

      <div class="sistema-inactivo" *ngIf="!monitoreoActivo">
        <div class="mensaje-inactivo">
          <i class="fas fa-satellite-dish"></i>
          <h4>Sistema de Monitoreo Inactivo</h4>
          <p>Haga clic en "Iniciar Monitoreo" para comenzar a recibir datos meteorológicos en tiempo real de los glaciares.</p>
          <p><small>Los datos se actualizan cada 2 minutos desde OpenMeteo API</small></p>
        </div>
      </div>

      <div class="error-conexion" *ngIf="errorConexion">
        <div class="mensaje-error">
          <i class="fas fa-exclamation-triangle"></i>
          <h4>Error de Conexión</h4>
          <p>{{ mensajeError }}</p>
          <button (click)="reintentar()" class="btn-reintentar">
            <i class="fas fa-redo"></i>
            Reintentar
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./monitoreo-tiempo-real.component.scss']
})
export class MonitoreoTiempoRealComponent implements OnInit, OnDestroy {
  private readonly API_BASE = 'http://localhost:8000/api';
  
  datosGlaciares: DatosMeteorologicos[] = [];
  monitoreoActivo: boolean = false;
  ultimaActualizacion: Date | null = null;
  errorConexion: boolean = false;
  mensajeError: string = '';
  totalAlertas: number = 0;
  
  private subscription = new Subscription();

  constructor(
    private http: HttpClient,
    private openMeteoService: OpenMeteoService
  ) {}

  ngOnInit(): void {
    console.log('🌡️ Componente de monitoreo meteorológico inicializado');
  }

  ngOnDestroy(): void {
    this.detenerMonitoreo();
  }

  get temperaturaPromedio(): number {
    if (this.datosGlaciares.length === 0) return 0;
    const suma = this.datosGlaciares.reduce((acc, datos) => acc + datos.temperatura, 0);
    return suma / this.datosGlaciares.length;
  }

  /**
   * Inicia el monitoreo meteorológico en tiempo real
   */
  iniciarMonitoreo(): void {
    this.monitoreoActivo = true;
    this.errorConexion = false;
    
    // Obtener datos inmediatamente
    this.actualizarDatos();
    
    // Configurar actualización automática cada 2 minutos
    this.subscription.add(
      interval(2 * 60 * 1000) // 2 minutos
        .pipe(
          switchMap(() => this.openMeteoService.obtenerDatosGlaciares())
        )
        .subscribe({
          next: (datos) => this.procesarDatos(datos),
          error: (error) => this.manejarError(error)
        })
    );

    console.log('🚀 Monitoreo meteorológico iniciado');
  }

  /**
   * Detiene el monitoreo
   */
  detenerMonitoreo(): void {
    this.monitoreoActivo = false;
    this.subscription.unsubscribe();
    this.subscription = new Subscription();
    console.log('🛑 Monitoreo meteorológico detenido');
  }

  /**
   * Actualiza los datos meteorológicos
   */
  private actualizarDatos(): void {
    this.subscription.add(
      this.openMeteoService.obtenerDatosGlaciares().subscribe({
        next: (datos) => this.procesarDatos(datos),
        error: (error) => this.manejarError(error)
      })
    );
  }

  /**
   * Procesa los datos meteorológicos recibidos
   */
  private procesarDatos(datos: DatosMeteorologicos[]): void {
    this.datosGlaciares = datos;
    this.ultimaActualizacion = new Date();
    this.errorConexion = false;
    
    // Calcular número total de alertas
    this.totalAlertas = this.calcularTotalAlertas();
    
    console.log(`📊 Datos actualizados para ${datos.length} ubicaciones`);
  }

  /**
   * Maneja errores de conexión
   */
  private manejarError(error: any): void {
    this.errorConexion = true;
    this.mensajeError = 'No se pudo conectar con el servicio meteorológico. Verifique su conexión a internet.';
    console.error('❌ Error en monitoreo meteorológico:', error);
  }

  /**
   * Reintenta la conexión
   */
  reintentar(): void {
    this.errorConexion = false;
    this.actualizarDatos();
  }

  /**
   * Calcula el total de alertas activas
   */
  private calcularTotalAlertas(): number {
    let total = 0;
    this.datosGlaciares.forEach(datos => {
      const condiciones = this.openMeteoService.convertirACondicionesAlerta(datos);
      const alertas = this.openMeteoService.evaluarAlertas(condiciones);
      total += alertas.length;
    });
    return total;
  }

  /**
   * Obtiene el nivel de riesgo para una ubicación
   */
  getNivelRiesgo(datos: DatosMeteorologicos): string {
    const condiciones = this.openMeteoService.convertirACondicionesAlerta(datos);
    const alertas = this.openMeteoService.evaluarAlertas(condiciones);
    
    if (alertas.some(a => a.nivel === 'roja')) return 'alto';
    if (alertas.some(a => a.nivel === 'naranja')) return 'medio';
    if (alertas.some(a => a.nivel === 'amarilla')) return 'bajo';
    return 'normal';
  }

  /**
   * Obtiene el texto del nivel de riesgo
   */
  getNivelRiesgoTexto(datos: DatosMeteorologicos): string {
    const nivel = this.getNivelRiesgo(datos);
    const textos = {
      'alto': 'Alto',
      'medio': 'Medio', 
      'bajo': 'Bajo',
      'normal': 'Normal'
    };
    return textos[nivel as keyof typeof textos] || 'Normal';
  }

  /**
   * Calcula el porcentaje de riesgo
   */
  getPorcentajeRiesgo(datos: DatosMeteorologicos): number {
    const condiciones = this.openMeteoService.convertirACondicionesAlerta(datos);
    const alertas = this.openMeteoService.evaluarAlertas(condiciones);
    
    if (alertas.length === 0) return Math.floor(Math.random() * 20); // 0-20% normal
    
    const maxPrioridad = Math.min(...alertas.map(a => a.prioridad));
    switch (maxPrioridad) {
      case 1: return Math.floor(Math.random() * 20) + 80; // 80-100% crítico
      case 2: return Math.floor(Math.random() * 30) + 50; // 50-80% alto
      case 3: return Math.floor(Math.random() * 30) + 20; // 20-50% medio
      default: return Math.floor(Math.random() * 20); // 0-20% bajo
    }
  }
}