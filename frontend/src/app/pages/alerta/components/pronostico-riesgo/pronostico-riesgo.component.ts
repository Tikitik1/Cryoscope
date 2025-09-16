import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pronostico-riesgo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pronostico-info-container">
      <div class="header-info">
        <div class="icono-header">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="titulo-info">
          <h3>Información de Monitoreo</h3>
          <p class="subtitulo">Datos meteorológicos de OpenMeteo</p>
        </div>
      </div>

      <div class="contenido-info">
        <div class="seccion-info">
          <h4>
            <i class="fas fa-database"></i>
            Fuente de Datos
          </h4>
          <p>
            Los datos meteorológicos se obtienen en tiempo real desde 
            <strong>OpenMeteo</strong>, una API meteorológica de código abierto 
            que proporciona información precisa y actualizada sobre las condiciones 
            climáticas en la región de Aysén.
          </p>
        </div>

        <div class="seccion-info">
          <h4>
            <i class="fas fa-th"></i>
            Sistema de Cuadrículas
          </h4>
          <p>
            El mapa muestra cuadrículas meteorológicas que cubren la región. 
            Cada cuadrícula representa una zona de monitoreo con datos específicos 
            de temperatura, precipitación, viento y otras variables climáticas 
            relevantes para el seguimiento glacial.
          </p>
        </div>

        <div class="seccion-info importante">
          <h4>
            <i class="fas fa-exclamation-circle"></i>
            Importancia de los Reportes
          </h4>
          <p>
            <strong>Tus reportes son fundamentales</strong> para mejorar el sistema de monitoreo. 
            Al enviar observaciones con ubicación específica, ayudas a:
          </p>
          <ul>
            <li>Validar los datos meteorológicos automáticos</li>
            <li>Identificar eventos que las estaciones no detectan</li>
            <li>Enfocar el monitoreo en áreas de mayor interés</li>
            <li>Mejorar la precisión de futuras predicciones</li>
          </ul>
        </div>

        <div class="cta-reportes">
          <p>
            <i class="fas fa-arrow-down"></i>
            <strong>Usa el sistema de reportes</strong> para contribuir con observaciones 
            locales que complementen los datos meteorológicos automáticos.
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./pronostico-riesgo.component.scss']
})
export class PronosticoRiesgoComponent {
  constructor() {}
}
