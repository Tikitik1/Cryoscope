import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info-alertas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-alertas-container">
      <!-- Información de cuadrícula seleccionada -->
      <div class="cuadricula-seleccionada" *ngIf="alerta && alerta.tipo === 'cuadricula_meteorologica'">
        <div class="header-cuadricula">
          <h3>
            <i class="fas fa-thermometer-half"></i>
            Datos Meteorológicos - Cuadrícula {{ alerta.id }}
          </h3>
          <span class="nivel-riesgo" [class]="'nivel-' + alerta.datos.nivelRiesgo">
            {{ alerta.datos.nivelRiesgo.toUpperCase() }}
          </span>
        </div>
        <div class="datos-meteorologicos">
          <div class="datos-grid">
            <div class="dato-item">
              <i class="fas fa-thermometer-half"></i>
              <div class="dato-info">
                <label>Temperatura</label>
                <span class="value">{{ alerta.datos.temperatura.actual }}°C</span>
                <small>Máx: {{ alerta.datos.temperatura.maxima }}°C / Mín: {{ alerta.datos.temperatura.minima }}°C</small>
              </div>
            </div>
            <div class="dato-item">
              <i class="fas fa-wind"></i>
              <div class="dato-info">
                <label>Viento</label>
                <span class="value">{{ alerta.datos.viento.velocidad }} km/h</span>
                <small>Dirección: {{ alerta.datos.viento.direccion }}°</small>
              </div>
            </div>
            <div class="dato-item">
              <i class="fas fa-cloud-rain"></i>
              <div class="dato-info">
                <label>Precipitación</label>
                <span class="value">{{ alerta.datos.precipitacion }} mm</span>
              </div>
            </div>
            <div class="dato-item">
              <i class="fas fa-eye"></i>
              <div class="dato-info">
                <label>Visibilidad</label>
                <span class="value">{{ alerta.datos.visibilidad || 'N/D' }} km</span>
              </div>
            </div>
            <div class="dato-item">
              <i class="fas fa-tint"></i>
              <div class="dato-info">
                <label>Humedad</label>
                <span class="value">{{ alerta.datos.humedad || 'N/D' }}%</span>
              </div>
            </div>
            <div class="dato-item">
              <i class="fas fa-sun"></i>
              <div class="dato-info">
                <label>Radiación Solar</label>
                <span class="value">{{ alerta.datos.radiacionSolar || 'N/D' }} W/m²</span>
              </div>
            </div>
          </div>
          <div class="ubicacion-info">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ alerta.coordenadas.lat | number:'1.4-4' }}°, {{ alerta.coordenadas.lng | number:'1.4-4' }}°</span>
          </div>
          <div class="timestamp-info">
            <i class="fas fa-clock"></i>
            <span>Actualizado: {{ alerta.datos.timestamp | date:'medium' }}</span>
          </div>
          <div class="explicacion-riesgo" *ngIf="alerta.datos.explicacion">
            <h4>¿Por qué el riesgo es {{ alerta.datos.nivelRiesgo.toUpperCase() }}?</h4>
            <p><strong>Factor principal:</strong> {{ alerta.datos.explicacion.factorPrincipal }}</p>
            <p><strong>Riesgo glaciar:</strong> {{ alerta.datos.explicacion.riesgoGlaciar }}</p>
            <ul *ngIf="alerta.datos.explicacion.recomendaciones && alerta.datos.explicacion.recomendaciones.length">
              <li *ngFor="let rec of alerta.datos.explicacion.recomendaciones">🔎 {{ rec }}</li>
            </ul>
          </div>
          <div class="alertas-activas" *ngIf="alerta.datos.alertas && alerta.datos.alertas.length > 0">
            <h4>Condiciones Detectadas:</h4>
            <ul>
              <li *ngFor="let condicion of alerta.datos.alertas">{{ condicion }}</li>
            </ul>
          </div>
          <div class="glaciares-en-cuadricula" *ngIf="alerta.datos.glaciares && alerta.datos.glaciares.length > 0">
            <h4>Glaciares dentro de la cuadrícula</h4>
            <p>Se han detectado <strong>{{ alerta.datos.glaciares.length }}</strong> glaciares en esta zona:</p>
            <ul>
              <li *ngFor="let glaciar of alerta.datos.glaciares">
                🏔️ <strong>{{ glaciar.nombre }}</strong> - Área: {{ glaciar.area | number:'1.2-2' }} km², Estado: {{ glaciar.estado }}
              </li>
            </ul>
          </div>
          <!-- Sistema de puntuación de riesgo -->
          <div class="risk-score-system" *ngIf="riskScoreInfo">
            <h4>Sistema de Puntuación de Riesgo</h4>
            <div class="risk-score-resumen">
              <span class="risk-score-total" [ngClass]="riskScoreInfo.color">Puntaje: {{ riskScoreInfo.score }} / 20</span>
              <span class="risk-score-nivel" [ngClass]="riskScoreInfo.color">Nivel: {{ riskScoreInfo.nivel }} <span *ngIf="riskScoreInfo.color==='rojo'">🟥</span><span *ngIf="riskScoreInfo.color==='naranja'">🟧</span><span *ngIf="riskScoreInfo.color==='amarillo'">🟨</span><span *ngIf="riskScoreInfo.color==='verde'">🟩</span></span>
              <span class="risk-score-accion">Acción: <strong>{{ riskScoreInfo.accion }}</strong></span>
            </div>
            <table class="risk-score-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Valor</th>
                  <th>Umbral</th>
                  <th>Puntos</th>
                  <th>Explicación</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of riskScoreInfo.criterios">
                  <td>{{ c.label }}</td>
                  <td>{{ c.valor }}</td>
                  <td>{{ c.umbral }}</td>
                  <td [ngClass]="c.cumple ? 'cumple' : 'nocumple'">{{ c.puntos }}</td>
                  <td>{{ c.explicacion }}</td>
                </tr>
              </tbody>
            </table>
            <div class="risk-score-leyenda">
              <strong>Leyenda:</strong>
              <ul>
                <li><span class="color-box rojo"></span> Crítico (14+)</li>
                <li><span class="color-box naranja"></span> Alto (9-13)</li>
                <li><span class="color-box amarillo"></span> Moderado (5-8)</li>
                <li><span class="color-box verde"></span> Bajo (0-4)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Mensaje cuando no hay cuadrícula seleccionada -->
      <div class="sin-seleccion" *ngIf="!alerta">
        <div class="icono-instruccion">
          <i class="fas fa-hand-pointer"></i>
        </div>
        <h4>Datos Meteorológicos</h4>
        <p>Haz clic en cualquier cuadrícula del mapa para ver los datos meteorológicos en tiempo real de esa zona específica.</p>
        <div class="leyenda-colores">
          <h5>Leyenda de Riesgo:</h5>
          <div class="color-item">
            <span class="color-indicator critico"></span>
            <span>Crítico - Condiciones extremas<br><small>Temperatura muy alta (>20°C), precipitación intensa (>30mm), vientos fuertes (>50km/h) o combinación de factores extremos.</small></span>
          </div>
          <div class="color-item">
            <span class="color-indicator alto"></span>
            <span>Alto - Requiere atención<br><small>Temperatura alta (>15°C), precipitación moderada (>15mm), vientos moderados (>30km/h) o dos factores en zona de riesgo.</small></span>
          </div>
          <div class="color-item">
            <span class="color-indicator moderado"></span>
            <span>Moderado - Condiciones normales<br><small>Temperatura entre 10-15°C, precipitación ligera, vientos suaves. Algún factor fuera de lo óptimo pero sin riesgo inmediato.</small></span>
          </div>
          <div class="color-item">
            <span class="color-indicator bajo"></span>
            <span>Bajo - Condiciones óptimas<br><small>Temperatura baja o fresca (<10°C), poca o nula precipitación, vientos suaves (&lt;15km/h), sin factores de riesgo.</small></span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./info-alertas.component.scss']
})
export class InfoAlertasComponent {
  @Input() alerta: any = null;

  get riskScoreInfo() {
    if (!this.alerta || !this.alerta.datos) return null;
    const d = this.alerta.datos;
    let score = 0;
    const criterios: { label: string, valor: any, umbral: any, puntos: number, cumple: boolean, explicacion: string }[] = [];

    // Temperatura > 10°C: 3 puntos
    if (d.temperatura?.actual > 10) {
      score += 3;
      criterios.push({ label: 'Temperatura', valor: d.temperatura.actual + '°C', umbral: '>10°C', puntos: 3, cumple: true, explicacion: 'Alta fusión' });
    } else {
      criterios.push({ label: 'Temperatura', valor: d.temperatura?.actual + '°C', umbral: '>10°C', puntos: 0, cumple: false, explicacion: 'Sin riesgo térmico relevante' });
    }
    // Radiación > 600 W/m²: 3 puntos
    if (d.radiacionSolar > 600) {
      score += 3;
      criterios.push({ label: 'Radiación Solar', valor: d.radiacionSolar + ' W/m²', umbral: '>600', puntos: 3, cumple: true, explicacion: 'Alta fusión' });
    } else {
      criterios.push({ label: 'Radiación Solar', valor: d.radiacionSolar + ' W/m²', umbral: '>600', puntos: 0, cumple: false, explicacion: 'Sin riesgo por radiación' });
    }
    // Precipitación > 50 mm: 3 puntos
    if (d.precipitacion > 50) {
      score += 3;
      criterios.push({ label: 'Precipitación', valor: d.precipitacion + ' mm', umbral: '>50', puntos: 3, cumple: true, explicacion: 'Riesgo de aluvión' });
    } else {
      criterios.push({ label: 'Precipitación', valor: d.precipitacion + ' mm', umbral: '>50', puntos: 0, cumple: false, explicacion: 'Sin riesgo de aluvión' });
    }
    // Viento > 70 km/h: 2 puntos
    if (d.viento?.velocidad > 70) {
      score += 2;
      criterios.push({ label: 'Viento', valor: d.viento.velocidad + ' km/h', umbral: '>70', puntos: 2, cumple: true, explicacion: 'Riesgo de fractura/flotación' });
    } else {
      criterios.push({ label: 'Viento', valor: d.viento?.velocidad + ' km/h', umbral: '>70', puntos: 0, cumple: false, explicacion: 'Sin riesgo por viento' });
    }
    // Nieve > 50 cm: 3 puntos
    if (d.nieve > 50) {
      score += 3;
      criterios.push({ label: 'Nieve', valor: d.nieve + ' cm', umbral: '>50', puntos: 3, cumple: true, explicacion: 'Avalancha' });
    } else {
      criterios.push({ label: 'Nieve', valor: d.nieve + ' cm', umbral: '>50', puntos: 0, cumple: false, explicacion: 'Sin riesgo de avalancha' });
    }
    // Caudal/nivel agua +50%: 3 puntos
    if (d.caudal > 50) {
      score += 3;
      criterios.push({ label: 'Caudal/Nivel Agua', valor: d.caudal, umbral: '>50%', puntos: 3, cumple: true, explicacion: 'Inundación/GLOF' });
    } else {
      criterios.push({ label: 'Caudal/Nivel Agua', valor: d.caudal, umbral: '>50%', puntos: 0, cumple: false, explicacion: 'Sin riesgo de inundación' });
    }
    // UV Index > 8: 1 punto
    if (d.uvIndex > 8) {
      score += 1;
      criterios.push({ label: 'Índice UV', valor: d.uvIndex, umbral: '>8', puntos: 1, cumple: true, explicacion: 'Riesgo térmico adicional' });
    } else {
      criterios.push({ label: 'Índice UV', valor: d.uvIndex, umbral: '>8', puntos: 0, cumple: false, explicacion: 'Sin riesgo UV extremo' });
    }

    // Nivel de alerta
    let nivel = 'Bajo', color = 'verde', accion = 'Sin acción';
    if (score >= 14) { nivel = 'Crítico'; color = 'rojo'; accion = 'Activar protocolo'; }
    else if (score >= 9) { nivel = 'Alto'; color = 'naranja'; accion = 'Emitir alerta'; }
    else if (score >= 5) { nivel = 'Moderado'; color = 'amarillo'; accion = 'Vigilar'; }
    else { nivel = 'Bajo'; color = 'verde'; accion = 'Sin acción'; }

    return { score, criterios, nivel, color, accion };
  }
}