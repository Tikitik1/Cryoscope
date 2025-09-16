import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulacionService } from '../../services/simulacion.service';
import { InformacionService } from '../../services/informacion.service';
import { SimulacionResultado, GlaciarData } from '../../models/interfaces';
import { SimuladorDeshieloComponent } from '../simulador-deshielo/simulador-deshielo.component';
import { CesiumViewerComponent } from '../cesium-viewer/cesium-viewer.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar-left',
  standalone: true,
  imports: [CommonModule, SimuladorDeshieloComponent, CesiumViewerComponent],
  templateUrl: './sidebar-left.component.html',
  styleUrls: ['./sidebar-left.component.scss']
})
export class SidebarLeftComponent implements OnInit, OnDestroy {
  simulacionEnCurso = false;
  simulacionRealizada = false;
  resultadoSimulacion: SimulacionResultado | null = null;
  errorSimulacion: string | null = null;
  
  glaciarSeleccionado: GlaciarData | null = null;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private simulacionService: SimulacionService,
    private informacionService: InformacionService
  ) {}  ngOnInit(): void {
    // Suscribirse a cambios en la información seleccionada
    const infoSub = this.informacionService.informacion$.subscribe(info => {
      if (info?.tipo === 'glaciar') {
        this.glaciarSeleccionado = this.convertirAGlaciarData(info.data);
        console.log('🏔️ Glaciar seleccionado:', this.glaciarSeleccionado.nombre);
      } else {
        this.glaciarSeleccionado = null;
      }
    });
    
    this.subscriptions.push(infoSub);
  }

  /**
   * Convierte los datos del glaciar del servicio de información a GlaciarData
   */
  private convertirAGlaciarData(data: any): GlaciarData {
    return {
      id: data.id || data.nombre || 'unknown',
      nombre: data.nombre || 'Glaciar sin nombre',
      area: data.area_km2 ? data.area_km2 * 1000000 : (data.area || 1000000), // Convertir a m²
      volumen: data.volumen_km3 || (data.volumen || 0.5), // En km³
      geometria: data.geometria || null,
      propiedades: data,
      latitud: data.latitud || data.lat || -45.5,
      longitud: data.longitud || data.lng || data.lon || -72.0,
      tipo: data.clasificacion || data.tipo || 'Glaciar de valle',
      altura_media: data.altura_media_m,
      altura_maxima: data.altura_maxima_m,
      altura_minima: data.altura_minima_m,
      clasificacion: data.clasificacion,
      region: data.region || 'Aysén',
      comuna: data.comuna
    };
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Inicia la simulación de deshielo
   */
  iniciarSimulacion(): void {
    if (this.simulacionEnCurso) return;

    this.simulacionEnCurso = true;
    this.errorSimulacion = null;
    this.simulacionRealizada = false;

    this.simulacionService.iniciarSimulacion({
      temperatura: 3.5,
      tiempoSimulacion: 24,
      factorDeshielo: 1.2
    }).subscribe({
      next: (resultado) => {
        this.resultadoSimulacion = resultado;
        this.simulacionRealizada = true;
        this.simulacionEnCurso = false;
      },
      error: (error) => {
        console.error('Error en simulación:', error);
        this.errorSimulacion = 'Error al ejecutar la simulación. Intente nuevamente.';
        this.simulacionEnCurso = false;
      }
    });
  }

  /**
   * Reinicia la simulación
   */
  reiniciarSimulacion(): void {
    this.simulacionRealizada = false;
    this.resultadoSimulacion = null;
    this.errorSimulacion = null;
  }

  /**
   * Formatea números grandes con separadores de miles
   */
  formatearNumero(numero: number): string {
    return numero.toLocaleString('es-CL');
  }

  /**
   * Inicializa la visualización 3D (placeholder para Cesium/Three.js)
   */
  private inicializarVisualizacion3D(): void {
    const container = document.getElementById('glacier-3d-container');
    if (!container) return;

    // Placeholder para la implementación de Cesium o Three.js
    // Por ahora, agregamos un fondo simulado
    container.style.background = `
      linear-gradient(135deg, #87CEEB 0%, #4682B4 50%, #2F4F4F 100%),
      url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon fill="white" opacity="0.3" points="20,80 50,20 80,80"/><polygon fill="white" opacity="0.2" points="10,90 30,50 50,90"/><polygon fill="white" opacity="0.4" points="60,90 80,30 90,90"/></svg>')
    `;
    container.style.backgroundSize = 'cover, 200px 200px';
    container.style.backgroundRepeat = 'no-repeat, repeat';

    // Agregar texto indicativo
    const placeholder = document.createElement('div');
    placeholder.className = 'visualization-placeholder';
    placeholder.innerHTML = `
      <div class="glacier-icon">🏔️</div>
      <p>Visualización 3D</p>
      <small>Cesium/Three.js</small>
    `;
    container.appendChild(placeholder);  }

  /**
   * Cierra la vista 3D del glaciar (método para compatibilidad, pero la vista 3D siempre está activa)
   */
  cerrarVisor3D(): void {
    console.log('❌ Vista 3D siempre activa cuando hay glaciar seleccionado');
  }
}
