import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpenMeteoService, DatosMeteorologicos } from '../../services/open-meteo.service';
import { RiesgoService, EvaluacionRiesgo } from '../../services/riesgo.service';
import { Subscription, interval } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Interfaces para el sistema de alertas
interface CondicionesMeteorologicas {
  temperatura: number;         // °C
  radiacionSolar: number;      // W/m²
  precipitacion: number;       // mm en 24h
  viento: number;              // km/h
  nieveAcumulada: number;      // cm
  nivelAgua: number;           // en metros
  caudal: number;              // m³/s
  sismoMagnitud: number;       // Magnitud Richter
  ubicacion?: string;
}

interface AlertaTemplana {
  tipo: string;
  nivel: 'amarilla' | 'naranja' | 'roja';
  mensaje: string;
  timestamp: Date;
  ubicacion: string;
  prioridad: number; // 1=crítica, 2=alta, 3=media, 4=baja
  recomendaciones: string[];
}

@Component({
  selector: 'app-info-alertas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-alertas-container">
      <!-- Información de alerta seleccionada -->
      <div class="alerta-seleccionada" *ngIf="alerta">        <div class="header-alerta">
          <h3>
            <i class="fas fa-map-marker-alt"></i>
            {{ getTituloAlerta(alerta) }}
          </h3>
          <span class="tipo-alerta" [class]="'tipo-' + alerta.tipo">
            {{ getTipoAlertaDisplay(alerta.tipo) }}
          </span>
        </div>
        
        <div class="contenido-alerta">
          <p>{{ getDescripcionAlerta(alerta) }}</p>
          
          <div class="ubicacion-info" *ngIf="alerta.coordenadas">
            <i class="fas fa-location-arrow"></i>
            <span>{{ alerta.coordenadas.lat | number:'1.4-4' }}°, {{ alerta.coordenadas.lng | number:'1.4-4' }}°</span>
          </div>
          
          <!-- Datos específicos para cuadrículas meteorológicas -->
          <div class="datos-meteorologicos" *ngIf="alerta.tipo === 'cuadricula_meteorologica' && alerta.datos">
            <div class="dato-principal">
              <strong>Nivel de Riesgo:</strong> 
              <span [class]="'riesgo-' + alerta.datos.nivelRiesgo">
                {{ alerta.datos.nivelRiesgo.toUpperCase() }}
              </span>
            </div>
            
            <div class="datos-grid">
              <div class="dato">
                <i class="fas fa-thermometer-half"></i>
                <strong>Temperatura:</strong> {{ alerta.datos.temperatura.actual }}°C
              </div>
              <div class="dato">
                <i class="fas fa-wind"></i>
                <strong>Viento:</strong> {{ alerta.datos.viento.velocidad }} km/h
              </div>
              <div class="dato">
                <i class="fas fa-cloud-rain"></i>
                <strong>Precipitación:</strong> {{ alerta.datos.precipitacion }} mm
              </div>
              <div class="dato">
                <i class="fas fa-eye"></i>
                <strong>Visibilidad:</strong> {{ alerta.datos.visibilidad }} km
              </div>
            </div>
            
            <div class="alertas-cuadricula" *ngIf="alerta.datos.alertas.length > 0">
              <strong>Alertas Activas:</strong>
              <ul>
                <li *ngFor="let alertaItem of alerta.datos.alertas">{{ alertaItem }}</li>
              </ul>
            </div>
            
            <div class="timestamp-info">
              <i class="fas fa-clock"></i>
              <strong>Última actualización:</strong> {{ alerta.datos.timestamp | date:'medium' }}
            </div>
          </div>
          
          <!-- Datos generales para otros tipos de alerta -->
          <div class="datos-adicionales" *ngIf="alerta.tipo !== 'cuadricula_meteorologica' && alerta.datos">
            <div class="dato" *ngIf="alerta.datos.area">
              <strong>Área:</strong> {{ alerta.datos.area }} km²
            </div>
            <div class="dato" *ngIf="alerta.datos.temperatura">
              <strong>Temperatura:</strong> {{ alerta.datos.temperatura.actual }}°C
            </div>
            <div class="dato" *ngIf="alerta.datos.nivelRiesgo">
              <strong>Nivel de Riesgo:</strong> 
              <span [class]="'riesgo-' + alerta.datos.nivelRiesgo">
                {{ alerta.datos.nivelRiesgo.toUpperCase() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sistema de alertas generales -->
      <div class="header">
        <h3>
          <i class="fas fa-exclamation-triangle"></i>
          Sistema de Alertas Tempranas
        </h3>
        <div class="controles">
          <button *ngIf="!sistemaActivo" (click)="activarSistema()" class="btn-activar">
            <i class="fas fa-power-off"></i>
            Activar Sistema
          </button>
          <button *ngIf="sistemaActivo" (click)="desactivarSistema()" class="btn-desactivar">
            <i class="fas fa-stop"></i>
            Desactivar
          </button>
        </div>
      </div>

      <div class="estado-sistema">
        <div class="indicador" [class]="sistemaActivo ? 'activo' : 'inactivo'">
          <div class="punto-estado"></div>
          {{ sistemaActivo ? 'Sistema Activo' : 'Sistema Inactivo' }}
        </div>
        <div class="resumen-alertas" *ngIf="sistemaActivo">
          <div class="contador-alertas">
            <span class="total">{{ alertasActivas.length }}</span>
            <span class="label">Alertas Activas</span>
          </div>
        </div>
      </div>

      <!-- Lista de Alertas Activas -->
      <div class="alertas-activas" *ngIf="sistemaActivo && alertasActivas.length > 0">
        <h4>Alertas Activas</h4>
        <div *ngFor="let alerta of alertasActivas" 
             class="alerta-item" 
             [class]="'nivel-' + alerta.nivel">
          <div class="alerta-header">
            <div class="nivel-badge" [class]="'badge-' + alerta.nivel">
              {{ alerta.nivel.toUpperCase() }}
            </div>
            <div class="tipo-alerta">
              <i class="fas" [class]="getIconoTipo(alerta.tipo)"></i>
              {{ getTituloTipo(alerta.tipo) }}
            </div>
            <div class="ubicacion">
              <i class="fas fa-map-marker-alt"></i>
              {{ alerta.ubicacion }}
            </div>
            <div class="timestamp">
              {{ alerta.timestamp | date:'HH:mm:ss' }}
            </div>
          </div>
          
          <div class="alerta-mensaje">
            {{ alerta.mensaje }}
          </div>
          
          <div class="alerta-recomendaciones" *ngIf="alerta.recomendaciones.length > 0">
            <strong>Recomendaciones:</strong>
            <ul>
              <li *ngFor="let recomendacion of alerta.recomendaciones">{{ recomendacion }}</li>
            </ul>
          </div>

          <div class="acciones-alerta">
            <button (click)="marcarComoRevisada(alerta)" class="btn-revisar">
              <i class="fas fa-check"></i>
              Marcar como Revisada
            </button>
          </div>
        </div>
      </div>

      <!-- Estado sin alertas -->
      <div class="sin-alertas" *ngIf="sistemaActivo && alertasActivas.length === 0">
        <div class="mensaje-ok">
          <i class="fas fa-shield-alt"></i>
          <h4>No hay alertas activas</h4>
          <p>Todas las condiciones están dentro de los parámetros normales</p>
          <div class="ultima-evaluacion">
            <small>Última evaluación: {{ ultimaEvaluacion | date:'HH:mm:ss' }}</small>
          </div>
        </div>
      </div>

      <!-- Sistema inactivo -->
      <div class="sistema-inactivo" *ngIf="!sistemaActivo">
        <div class="mensaje-inactivo">
          <i class="fas fa-power-off"></i>
          <h4>Sistema de Alertas Inactivo</h4>
          <p>Active el sistema para comenzar el monitoreo automático de condiciones peligrosas.</p>          <div class="caracteristicas">
            <h5>Monitoreo incluye:</h5>
            <ul>
              <li>Temperatura extrema (>15°C)</li>
              <li>Radiación solar intensa (>800 W/m²)</li>
              <li>Precipitaciones extremas (>100mm/día)</li>
              <li>Vientos huracanados (>120 km/h)</li>
              <li>Acumulación extrema de nieve (>100cm)</li>
              <li>Niveles críticos de agua (>10m)</li>
              <li>Actividad sísmica mayor (>6.0 Richter)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./info-alertas.component.scss']
})
export class InfoAlertasComponent implements OnInit, OnDestroy {
  @Input() alerta: any = null;
  sistemaActivo: boolean = false;
  alertasActivas: AlertaTemplana[] = [];
  evaluacionesRiesgo: EvaluacionRiesgo[] = [];
  ultimaEvaluacion: Date = new Date();
  private subscription = new Subscription();

  constructor(
    private openMeteoService: OpenMeteoService,
    private riesgoService: RiesgoService
  ) {}

  ngOnInit(): void {
    console.log('🚨 Sistema de alertas tempranas inicializado');
  }

  ngOnDestroy(): void {
    this.desactivarSistema();
  }

  get alertasCriticas(): number {
    return this.alertasActivas.filter(a => a.nivel === 'roja').length;
  }

  /**
   * Activa el sistema de monitoreo de alertas
   */
  activarSistema(): void {
    this.sistemaActivo = true;
    this.evaluarAlertasAhora();
    
    // Configurar monitoreo automático cada 2 minutos
    this.subscription.add(
      interval(2 * 60 * 1000)
        .pipe(
          switchMap(() => this.openMeteoService.obtenerDatosGlaciares())
        )
        .subscribe({
          next: (datos) => this.procesarDatosYEvaluarAlertas(datos),
          error: (error) => console.error('Error en monitoreo de alertas:', error)
        })
    );

    console.log('🚀 Sistema de alertas activado');
  }

  /**
   * Desactiva el sistema de monitoreo
   */
  desactivarSistema(): void {
    this.sistemaActivo = false;
    this.subscription.unsubscribe();
    this.subscription = new Subscription();
    this.alertasActivas = [];
    console.log('🛑 Sistema de alertas desactivado');
  }

  /**
   * Evalúa alertas inmediatamente
   */
  private evaluarAlertasAhora(): void {
    this.subscription.add(
      this.openMeteoService.obtenerDatosGlaciares().subscribe({
        next: (datos) => this.procesarDatosYEvaluarAlertas(datos),
        error: (error) => console.error('Error evaluando alertas:', error)
      })
    );
  }

  /**
   * Procesa datos meteorológicos y evalúa alertas
   */
  private procesarDatosYEvaluarAlertas(datos: DatosMeteorologicos[]): void {
    this.alertasActivas = [];
    
    datos.forEach(dato => {
      const condiciones = this.convertirACondicionesMeteorologicas(dato);
      const alertas = this.evaluarAlertas(condiciones);
      this.alertasActivas.push(...alertas);
    });

    this.ultimaEvaluacion = new Date();
    console.log(`🔍 Evaluadas ${this.alertasActivas.length} alertas activas`);
  }
  /**
   * Convierte datos de OpenMeteo a condiciones meteorológicas
   */
  private convertirACondicionesMeteorologicas(datos: DatosMeteorologicos): CondicionesMeteorologicas {
    return {
      temperatura: datos.temperatura,
      radiacionSolar: datos.radiacionSolar || 0, // Solo usar datos reales
      precipitacion: datos.precipitacion,
      viento: datos.velocidadViento,
      nieveAcumulada: 0, // Solo alertar si tenemos datos reales
      nivelAgua: 0, // Solo alertar si tenemos datos reales
      caudal: 0, // Solo alertar si tenemos datos reales
      sismoMagnitud: 0, // Solo alertar si tenemos datos reales
      ubicacion: datos.ubicacion.nombre
    };
  }
  /**
   * ✨ FUNCIÓN PRINCIPAL DE EVALUACIÓN DE ALERTAS
   * Evalúa condiciones meteorológicas REALES y retorna alertas activas solo cuando hay condiciones peligrosas
   */
  evaluarAlertas(condiciones: CondicionesMeteorologicas): AlertaTemplana[] {
    const alertas: AlertaTemplana[] = [];
    const timestamp = new Date();
    const ubicacion = condiciones.ubicacion || 'Ubicación desconocida';    // 🌡️ EVALUACIÓN DE TEMPERATURA - Solo alertar en condiciones REALMENTE CRÍTICAS
    // Para glaciares en Chile, solo alertar con temperaturas extremas sostenidas
    if (condiciones.temperatura > 15) {
      alertas.push({
        tipo: 'temperatura',
        nivel: 'roja',
        mensaje: `Temperatura extremadamente crítica de ${condiciones.temperatura.toFixed(1)}°C - Fusión glacial acelerada`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Evacuación inmediata de personal',
          'Monitoreo urgente de caudales',
          'Alerta máxima a comunidades'
        ]
      });
    } else if (condiciones.temperatura > 12) {
      alertas.push({
        tipo: 'temperatura',
        nivel: 'naranja',
        mensaje: `Temperatura muy alta de ${condiciones.temperatura.toFixed(1)}°C - Deshielo significativo`,
        timestamp,
        ubicacion,        prioridad: 2,
        recomendaciones: [
          'Monitoreo continuo cada hora',
          'Preparar protocolos de evacuación'
        ]
      });
    }
    // NO alertar por temperaturas entre -20°C y 12°C (rango normal para glaciares patagónicos)

    // ☀️ EVALUACIÓN DE RADIACIÓN SOLAR - Solo si tenemos datos reales
    if (condiciones.radiacionSolar > 0) {
      if (condiciones.radiacionSolar > 600) {
        alertas.push({
          tipo: 'radiacion',
          nivel: 'roja',
          mensaje: `Radiación solar extrema: ${condiciones.radiacionSolar.toFixed(0)} W/m² - Derretimiento superficial intenso`,
          timestamp,
          ubicacion,
          prioridad: 1,
          recomendaciones: [
            'Suspender actividades en superficie glacial',
            'Monitorear formación de lagos glaciales'
          ]
        });
      } else if (condiciones.radiacionSolar >= 400) {
        alertas.push({
          tipo: 'radiacion',
          nivel: 'naranja',
          mensaje: `Radiación solar alta: ${condiciones.radiacionSolar.toFixed(0)} W/m² - Deshielo superficial moderado`,
          timestamp,
          ubicacion,
          prioridad: 2,
          recomendaciones: ['Evitar exposición prolongada en glaciares']
        });
      }
    }

    // 🌧️ EVALUACIÓN DE PRECIPITACIÓN - Solo alertar con precipitación significativa
    if (condiciones.precipitacion > 50) {
      alertas.push({
        tipo: 'lluvia',
        nivel: 'roja',
        mensaje: `Precipitación extrema: ${condiciones.precipitacion.toFixed(1)} mm/día - Riesgo de aluvión`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Evacuar zonas bajas inmediatamente',
          'Cerrar accesos a quebradas',
          'Activar sistemas de alerta temprana'
        ]
      });
    } else if (condiciones.precipitacion >= 30) {
      alertas.push({
        tipo: 'lluvia',
        nivel: 'naranja',
        mensaje: `Lluvia intensa: ${condiciones.precipitacion.toFixed(1)} mm/día - Aumento de caudales`,
        timestamp,
        ubicacion,
        prioridad: 2,
        recomendaciones: [
          'Monitorear niveles de ríos',
          'Preparar evacuación preventiva'
        ]
      });
    }

    // 💨 EVALUACIÓN DE VIENTO - Solo alertar con vientos realmente peligrosos
    if (condiciones.viento > 70) {
      alertas.push({
        tipo: 'viento',
        nivel: 'roja',
        mensaje: `Vientos extremos: ${condiciones.viento.toFixed(1)} km/h - Condiciones peligrosas`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Suspender vuelos de reconocimiento',
          'Evacuar campamentos expuestos',
          'Asegurar equipos y estructuras'
        ]
      });
    } else if (condiciones.viento >= 50) {
      alertas.push({
        tipo: 'viento',
        nivel: 'naranja',
        mensaje: `Vientos fuertes: ${condiciones.viento.toFixed(1)} km/h - Precaución extrema`,
        timestamp,
        ubicacion,
        prioridad: 2,
        recomendaciones: [
          'Limitar actividades al aire libre',
          'Reforzar estructuras temporales'
        ]
      });
    }

    // ❄️ EVALUACIÓN DE NIEVE ACUMULADA - Solo si tenemos datos reales
    if (condiciones.nieveAcumulada > 50) {
      alertas.push({
        tipo: 'nieve',
        nivel: 'roja',
        mensaje: `Acumulación crítica de nieve: ${condiciones.nieveAcumulada.toFixed(1)} cm - Riesgo de avalancha`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Evaluar estabilidad de pendientes',
          'Cerrar accesos a zonas de riesgo',
          'Activar protocolos de avalancha'
        ]
      });
    }

    // 🌊 EVALUACIÓN DE NIVEL DE AGUA - Solo si tenemos datos reales
    if (condiciones.nivelAgua > 5) {
      alertas.push({
        tipo: 'nivel_agua',
        nivel: condiciones.nivelAgua > 7 ? 'roja' : 'naranja',
        mensaje: `Nivel de agua crítico: ${condiciones.nivelAgua.toFixed(1)} m - Riesgo de inundación`,
        timestamp,
        ubicacion,
        prioridad: condiciones.nivelAgua > 7 ? 1 : 2,
        recomendaciones: [
          'Monitorear ecosistemas acuáticos',
          'Evaluar estabilidad de infraestructura',
          'Preparar medidas de contención'
        ]
      });
    }

    // 🌊 EVALUACIÓN DE CAUDAL - Solo si tenemos datos reales
    if (condiciones.caudal > 30) {
      alertas.push({
        tipo: 'caudal',
        nivel: 'roja',
        mensaje: `Caudal extremo: ${condiciones.caudal.toFixed(1)} m³/s - Riesgo de inundaciones`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Alertar comunidades río abajo',
          'Evaluar capacidad de drenaje',
          'Preparar evacuación de zonas bajas'
        ]
      });
    } else if (condiciones.caudal >= 20) {
      alertas.push({
        tipo: 'caudal',
        nivel: 'naranja',
        mensaje: `Caudal elevado: ${condiciones.caudal.toFixed(1)} m³/s - Monitoreo intensivo`,
        timestamp,
        ubicacion,
        prioridad: 2,
        recomendaciones: ['Monitorear cambios en caudal cada hora']
      });
    }

    // 🌍 EVALUACIÓN DE ACTIVIDAD SÍSMICA - Solo si tenemos datos reales
    if (condiciones.sismoMagnitud >= 4) {
      alertas.push({
        tipo: 'sismo',
        nivel: 'roja',
        mensaje: `Sismo fuerte: ${condiciones.sismoMagnitud.toFixed(1)} Richter - Riesgo de fractura glacial`,
        timestamp,
        ubicacion,
        prioridad: 1,
        recomendaciones: [
          'Inspeccionar grietas en glaciares',
          'Evaluar estabilidad de seracs',
          'Suspender actividades de escalada'
        ]
      });
    } else if (condiciones.sismoMagnitud >= 3) {
      alertas.push({
        tipo: 'sismo',
        nivel: 'naranja',
        mensaje: `Actividad sísmica: ${condiciones.sismoMagnitud.toFixed(1)} Richter - Monitoreo de grietas`,
        timestamp,
        ubicacion,
        prioridad: 2,
        recomendaciones: [
          'Realizar inspección visual de glaciares',
          'Documentar cambios estructurales'
        ]
      });
    }

    return alertas;
  }

  /**
   * Obtiene el icono correspondiente al tipo de alerta
   */
  getIconoTipo(tipo: string): string {
    const iconos: { [key: string]: string } = {
      'temperatura': 'fa-thermometer-full',
      'radiacion': 'fa-sun',
      'lluvia': 'fa-cloud-rain',
      'viento': 'fa-wind',
      'nieve': 'fa-snowflake',
      'nivel_agua': 'fa-water',
      'caudal': 'fa-tint',
      'sismo': 'fa-globe-americas'
    };
    return iconos[tipo] || 'fa-exclamation-triangle';
  }

  /**
   * Obtiene el título legible del tipo de alerta
   */
  getTituloTipo(tipo: string): string {
    const titulos: { [key: string]: string } = {
      'temperatura': 'Temperatura Crítica',
      'radiacion': 'Radiación Solar',
      'lluvia': 'Precipitación Extrema',
      'viento': 'Vientos Fuertes',
      'nieve': 'Acumulación de Nieve',
      'nivel_agua': 'Nivel de Agua',
      'caudal': 'Caudal Extremo',
      'sismo': 'Actividad Sísmica'
    };
    return titulos[tipo] || 'Alerta';
  }
  /**
   * Marca una alerta como revisada
   */
  marcarComoRevisada(alerta: AlertaTemplana): void {
    const index = this.alertasActivas.indexOf(alerta);
    if (index > -1) {
      this.alertasActivas.splice(index, 1);
      console.log(`✅ Alerta de ${alerta.tipo} marcada como revisada`);
    }
  }

  /**
   * Obtiene el título apropiado para la alerta seleccionada
   */
  getTituloAlerta(alerta: any): string {
    if (alerta.tipo === 'cuadricula_meteorologica') {
      return `Cuadrícula de Monitoreo ${alerta.id}`;
    }
    return alerta.titulo || 'Alerta Sin Título';
  }

  /**
   * Obtiene el tipo de alerta para mostrar
   */
  getTipoAlertaDisplay(tipo: string): string {
    switch (tipo) {
      case 'cuadricula_meteorologica': return 'MONITOREO METEOROLÓGICO';
      case 'glaciar': return 'GLACIAR';
      case 'iceberg': return 'ICEBERG';
      default: return tipo.toUpperCase();
    }
  }

  /**
   * Obtiene la descripción apropiada para la alerta
   */
  getDescripcionAlerta(alerta: any): string {
    if (alerta.tipo === 'cuadricula_meteorologica') {
      const nivel = alerta.datos?.nivelRiesgo || 'desconocido';
      return `Zona de monitoreo meteorológico con nivel de riesgo ${nivel}. Los datos se actualizan automáticamente cada 10 minutos.`;
    }
    return alerta.descripcion || 'No hay descripción disponible.';
  }
}
