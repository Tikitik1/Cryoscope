import { Component, OnInit, OnDestroy, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AysenMeteoService, CuadriculaAysen, DatosMeteorologicosCuadricula } from '../../services/aysen-meteo.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cuadriculas-aysen',
  standalone: true,
  imports: [CommonModule],  template: `
    <!-- Componente oculto - solo carga datos para análisis detallado -->
    <div style="display: none;">
      <!-- Los datos se cargan en segundo plano para el análisis detallado -->
    </div>
  `,  styles: [``]
})
export class CuadriculasAysenComponent implements OnInit, OnDestroy {
  @Output() cuadriculaSeleccionada = new EventEmitter<DatosMeteorologicosCuadricula>();

  private meteoService = inject(AysenMeteoService);
  
  cuadriculas: CuadriculaAysen[] = [];
  datosCuadriculas: DatosMeteorologicosCuadricula[] = [];
  cargando = true;
  private subscription?: Subscription;

  ngOnInit() {
    this.cargarDatos();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  cargarDatos() {
    this.cargando = true;
    this.subscription = this.meteoService.obtenerDatosTodasCuadriculas().subscribe({
      next: (datos: DatosMeteorologicosCuadricula[]) => {
        this.datosCuadriculas = datos;
        this.cargando = false;
      },
      error: (error: any) => {
        console.error('Error al cargar datos meteorológicos:', error);
        this.cargando = false;
      }
    });
  }

  actualizarDatos() {
    this.cargarDatos();
  }
  seleccionarCuadricula(datos: DatosMeteorologicosCuadricula) {
    console.log('🎯 Cuadrícula seleccionada para análisis detallado:', datos);
    this.cuadriculaSeleccionada.emit(datos);
  }

  // Método público para seleccionar cuadrículas desde otros componentes (ej: mapa)
  seleccionarCuadriculaPorId(cuadriculaId: string) {
    const cuadriculaEncontrada = this.datosCuadriculas.find(d => d.cuadriculaId === cuadriculaId);
    if (cuadriculaEncontrada) {
      this.seleccionarCuadricula(cuadriculaEncontrada);
    } else {
      console.warn('Cuadrícula no encontrada:', cuadriculaId);
    }
  }

  // Método para obtener todas las cuadrículas (útil para otros componentes)
  obtenerTodasLasCuadriculas(): DatosMeteorologicosCuadricula[] {
    return this.datosCuadriculas;
  }

  obtenerNombreCuadricula(id: string): string {
    // Extraer la información de la zona del ID
    const partes = id.split('_');
    if (partes.length >= 2) {
      const zona = partes[0];
      const numero = partes[1];
      return `Zona ${zona.toUpperCase()} ${numero}`;
    }
    return `Zona ${id}`;
  }

  getNivelRiesgoTexto(nivel: string): string {
    const textos = {
      'bajo': 'Condiciones Estables',
      'medio': 'Condiciones Moderadas',
      'alto': 'Condiciones Críticas'
    };
    return textos[nivel as keyof typeof textos] || 'Desconocido';
  }

  getResumenBasico(datos: DatosMeteorologicosCuadricula): string {
    const factores = [];
    
    if (datos.temperatura.actual > 15) {
      factores.push('temperatura elevada');
    } else if (datos.temperatura.actual < 0) {
      factores.push('temperatura bajo cero');
    }
    
    if (datos.precipitacion > 20) {
      factores.push('alta precipitación');
    }
    
    if (datos.viento.velocidad > 30) {
      factores.push('vientos fuertes');
    }
    
    if (factores.length === 0) {
      return 'Condiciones meteorológicas normales para la zona.';
    }
    
    return `Monitoreo por ${factores.join(', ')}.`;
  }

  get alertasCriticas(): number {
    return this.datosCuadriculas.filter(d => d.nivelRiesgo === 'alto').length;
  }

  get temperaturaPromedio(): number {
    if (this.datosCuadriculas.length === 0) return 0;
    const suma = this.datosCuadriculas.reduce((acc, d) => acc + d.temperatura.actual, 0);
    return suma / this.datosCuadriculas.length;
  }
}
