import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { AysenMeteoService, DatosMeteorologicosCuadricula, CuadriculaAysen } from '../../services/aysen-meteo.service';

// Fix para iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

@Component({
  selector: 'app-mapa-aysen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mapa-container">
      <div class="mapa-header">
        <h3>Región de Aysén - Monitoreo de Glaciares</h3>
        <div class="controles-mapa">          <button class="btn-control" (click)="cargarDatosReales()" title="Cargar datos desde backend">
            <i class="fas fa-refresh"></i>
            Actualizar
          </button>
        </div>
      </div>
      
      <div class="mapa-content" #mapaContainer id="mapa-aysen">
        <!-- El mapa de Leaflet se renderizará aquí -->
      </div>
        <!-- Información del glaciar seleccionado -->
      <div class="info-glaciar" *ngIf="glaciarSeleccionado">
        <h4>{{glaciarSeleccionado.nombre}}</h4>
        <div class="info-details">
          <p><strong>Área:</strong> {{glaciarSeleccionado.area}} km²</p>
          <p><strong>Volumen:</strong> {{glaciarSeleccionado.volumen}} km³</p>
          <p><strong>Elevación:</strong> {{glaciarSeleccionado.elevacion}} m</p>
          <p><strong>Clasificación:</strong> {{glaciarSeleccionado.clasificacion}}</p>
          <p><strong>Orientación:</strong> {{glaciarSeleccionado.orientacion || 'N/A'}}</p>
          <p><strong>Frente termina en:</strong> {{glaciarSeleccionado.frenteTermina}}</p>
          <p><strong>Estado:</strong> 
            <span [class]="'estado-' + glaciarSeleccionado.estado.toLowerCase().replace(' ', '-')">
              {{glaciarSeleccionado.estado}}
            </span>
          </p>
          <p><strong>Última actualización:</strong> {{glaciarSeleccionado.ultimaMedicion | date:'short'}}</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./mapa-aysen.component.scss']
})
export class MapaAysenComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapaContainer', { static: false }) mapaContainer!: ElementRef;
  @Output() alertaSeleccionada = new EventEmitter<any>();
  
  private map: L.Map | null = null;
  private glaciaresLayer: L.GeoJSON | null = null;
  private cuadriculasLayer: L.LayerGroup | null = null;
  private subscriptions: Subscription[] = [];
  private readonly API_BASE = 'http://localhost:8000/api';

  glaciarSeleccionado: any = null;
  glaciares: any[] = [];
  cuadriculas: (DatosMeteorologicosCuadricula & { centro?: { lat: number, lng: number } })[] = [];

  constructor(
    private http: HttpClient,
    private meteoService: AysenMeteoService
  ) {}

  ngOnInit() {
    console.log('🗺️ Mapa de Aysén inicializado');
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.inicializarMapa();
      this.cargarDatosReales();
      this.cargarCuadriculasConAlertas();
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.map) {
      this.map.remove();
    }
  }  /**
   * Carga datos reales de glaciares como shapefiles desde el backend
   */
  cargarDatosReales() {
    console.log('📡 Cargando shapefiles de glaciares desde /icebergs/geojson-optimizado...');
    
    this.http.get(`${this.API_BASE}/icebergs/geojson-optimizado`).subscribe({
      next: (geojsonData: any) => {
        console.log('📊 GeoJSON de glaciares recibido:', geojsonData);
        
        if (geojsonData.features && Array.isArray(geojsonData.features)) {
          // Agregar los shapefiles como capa vectorial
          this.agregarCapaGlaciares(geojsonData);
          
          // Extraer información básica para el panel lateral
          this.glaciares = geojsonData.features.map((feature: any, index: number) => ({
            id: index,
            nombre: feature.properties.nombre || `Glaciar #${index + 1}`,
            area: feature.properties.area_km2 || 0,
            elevacion: feature.properties.altura_media || 0,
            estado: this.determinarEstadoGlaciar(feature.properties),
            lat: this.obtenerCentroide(feature.geometry).lat,
            lng: this.obtenerCentroide(feature.geometry).lng,
            volumen: feature.properties.volumen_km3 || 0,
            clasificacion: feature.properties.clasificacion || 'Glaciar',
            orientacion: feature.properties.orientacion || 'N/A',
            frenteTermina: feature.properties.frente_termina || 'No especificado',
            ultimaMedicion: new Date()
          }));
          
          console.log(`✅ Cargados ${geojsonData.features.length} glaciares como shapefiles`);
          console.log(`📊 Metadatos: ${JSON.stringify(geojsonData.metadata, null, 2)}`);
        } else {
          console.warn('⚠️ Formato de GeoJSON inesperado:', geojsonData);
          this.cargarDatosFallback();
        }
      },
      error: (error) => {
        console.error('❌ Error cargando shapefiles de glaciares:', error);
        console.warn('⚠️ No se pudieron cargar datos del backend. Cargando datos de fallback...');
        this.cargarDatosFallback();
      }
    });
  }
  /**
   * Carga datos de fallback si falla el backend
   */  private cargarDatosFallback() {
    console.log('⚠️ No se pudieron cargar datos desde el backend');
    console.log('📋 Sistema preparado para datos reales - sin información simulada');
    
    // Limpiar variables para estado sin datos
    this.glaciares = [];
    
    console.log('✅ Sistema limpio - esperando datos reales del backend');
  }

  /**
   * Determina el estado del glaciar basado en sus propiedades
   */  private determinarEstadoGlaciar(marcador: any): string {
    // Lógica para determinar estado basado en datos reales
    if (marcador.area_km2 > 50) {
      return 'Estable';
    } else if (marcador.area_km2 > 10) {
      return 'Monitoreando';
    } else {
      return 'En riesgo';
    }
  }

  private inicializarMapa() {
    try {
      const container = this.mapaContainer?.nativeElement || document.getElementById('mapa-aysen');
      
      if (!container) {
        console.error('❌ No se encontró el contenedor del mapa');
        return;
      }

      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn('⚠️ Contenedor sin dimensiones, reintentando...');
        setTimeout(() => this.inicializarMapa(), 500);
        return;
      }

      console.log('🗺️ Inicializando mapa de Aysén...');

      this.map = L.map(container, {
        center: [-46.5, -72.5],
        zoom: 7,
        zoomControl: true,
        attributionControl: true
      });

      // Agregar capa base
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(this.map);

      console.log('✅ Mapa de Aysén cargado correctamente');    } catch (error) {
      console.error('❌ Error inicializando mapa de Aysén:', error);
    }
  }
  /**
   * Agrega las geometrías de los glaciares como capas vectoriales en el mapa
   */
  private agregarCapaGlaciares(geojsonData: any) {
    if (!this.map) return;

    // Remover capa anterior si existe
    if (this.glaciaresLayer) {
      this.map.removeLayer(this.glaciaresLayer);
    }

    // Estilo para las geometrías de glaciares
    const estiloGlaciar = {
      fillColor: '#e6f3ff',
      weight: 2,
      opacity: 0.8,
      color: '#0066cc',
      fillOpacity: 0.6
    };

    // Estilo cuando el mouse está encima
    const estiloHover = {
      fillColor: '#b3d9ff',
      weight: 3,
      opacity: 1,
      color: '#003d7a',
      fillOpacity: 0.8
    };

    // Agregar capa GeoJSON al mapa
    this.glaciaresLayer = L.geoJSON(geojsonData, {
      style: estiloGlaciar,
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          const props = feature.properties;
          
          // Crear popup con información
          const popupContent = `
            <div class="popup-glaciar-geometria">
              <h4>🏔️ ${props.nombre}</h4>
              <p><strong>Área:</strong> ${props.area_km2} km²</p>
              <p><strong>Volumen:</strong> ${props.volumen_km3} km³</p>
              <p><strong>Alt. media:</strong> ${props.altura_media_m || props.altura_media || 'N/A'} m</p>
              <p><strong>Frente:</strong> ${props.frente_termina_en || props.frente_termina || 'N/A'}</p>
              <p><strong>Clasificación:</strong> ${props.clasificacion}</p>
            </div>
          `;
          layer.bindPopup(popupContent);

          // Eventos de interacción
          layer.on({
            mouseover: (e) => {
              const targetLayer = e.target;
              targetLayer.setStyle(estiloHover);
              targetLayer.bringToFront();
            },
            mouseout: (e) => {
              this.glaciaresLayer!.resetStyle(e.target);
            },
            click: (e) => {
              // Seleccionar glaciar al hacer clic
              const glaciarData = this.glaciares.find(g => g.nombre === props.nombre);
              if (glaciarData) {
                this.seleccionarGlaciar(glaciarData);
              }
            }
          });
        }
      }
    }).addTo(this.map);

    console.log('🗺️ Agregadas geometrías de glaciares al mapa como capa vectorial');
  }

  /**
   * Obtiene el centroide de una geometría GeoJSON
   */
  private obtenerCentroide(geometry: any): { lat: number; lng: number } {
    if (!geometry || !geometry.coordinates) {
      return { lat: -46.5, lng: -72.5 }; // Centro por defecto de Aysén
    }

    try {
      if (geometry.type === 'Point') {
        return { lat: geometry.coordinates[1], lng: geometry.coordinates[0] };
      } else if (geometry.type === 'Polygon') {
        // Calcular centroide de polígono simple
        const coords = geometry.coordinates[0];
        let lat = 0, lng = 0;
        for (const coord of coords) {
          lng += coord[0];
          lat += coord[1];
        }
        return { lat: lat / coords.length, lng: lng / coords.length };
      } else if (geometry.type === 'MultiPolygon') {
        // Usar el primer polígono
        const coords = geometry.coordinates[0][0];
        let lat = 0, lng = 0;
        for (const coord of coords) {
          lng += coord[0];
          lat += coord[1];
        }
        return { lat: lat / coords.length, lng: lng / coords.length };
      }
    } catch (error) {
      console.warn('Error calculando centroide:', error);
    }
    
    return { lat: -46.5, lng: -72.5 }; // Centro por defecto
  }

  seleccionarGlaciar(glaciar: any) {
    this.glaciarSeleccionado = glaciar;
    this.alertaSeleccionada.emit({
      tipo: 'glaciar',
      datos: glaciar,
      ubicacion: { lat: glaciar.lat, lng: glaciar.lng },
      titulo: glaciar.nombre,
      descripcion: `Glaciar de ${glaciar.area} km² en estado ${glaciar.estado}`
    });
    console.log('🏔️ Glaciar seleccionado:', glaciar);
    
    if (this.map) {
      this.map.setView([glaciar.lat, glaciar.lng], 10);
    }
  }

  seleccionarCuadricula(cuadricula: any) {
    // Si no hay glaciares cargados aún, intentar recargarlos
    if (!this.glaciares || this.glaciares.length === 0) {
      this.cargarDatosReales();
    }
    // Buscar glaciares dentro de la cuadrícula (área de influencia)
    const buffer = 0.25;
    const glaciaresEnCuadricula = (this.glaciares || []).filter(g => {
      return (
        g.lat >= (cuadricula.centro.lat - buffer) &&
        g.lat <= (cuadricula.centro.lat + buffer) &&
        g.lng >= (cuadricula.centro.lng - buffer) &&
        g.lng <= (cuadricula.centro.lng + buffer)
      );
    });

    this.alertaSeleccionada.emit({
      id: cuadricula.cuadriculaId,
      tipo: 'cuadricula_meteorologica',
      nivel: cuadricula.nivelRiesgo,
      datos: {
        ...cuadricula,
        glaciares: glaciaresEnCuadricula
      },
      coordenadas: cuadricula.centro
    });
    console.log('🎯 Cuadrícula seleccionada:', cuadricula, 'Glaciares en cuadrícula:', glaciaresEnCuadricula.length);
  }

  cargarCuadriculasConAlertas() {
    this.meteoService.obtenerDatosMeteorologicos().subscribe({
      next: (datos: DatosMeteorologicosCuadricula[]) => {
        // Para cada dato, buscar la cuadrícula base para obtener el centro
        this.meteoService.obtenerCuadriculas().subscribe((cuadriculasBase: CuadriculaAysen[]) => {
          this.cuadriculas = datos.map(d => {
            const base = cuadriculasBase.find(c => c.id === d.cuadriculaId);
            return { ...d, centro: base?.centro };
          });
          this.pintarAlertasCuadriculas();
        });
      },
      error: (error) => {
        console.error('Error cargando cuadrículas:', error);
      }
    });
  }
  pintarAlertasCuadriculas() {
    if (!this.map) return;
    
    if (this.cuadriculasLayer) {
      this.map.removeLayer(this.cuadriculasLayer);
    }
    
    this.cuadriculasLayer = L.layerGroup();
    
    console.log(`🎨 Pintando ${this.cuadriculas.length} cuadrículas monitoreadas en el mapa...`);
    
    this.cuadriculas.forEach((cuadricula, index) => {
      if (cuadricula.centro) {
        const color = this.getColorPorRiesgo(cuadricula.nivelRiesgo);
        const radius = this.getRadiusPorRiesgo(cuadricula.nivelRiesgo);
        
        const marker = L.circleMarker([cuadricula.centro.lat, cuadricula.centro.lng], {
          radius: radius,
          color: color,
          fillColor: color,
          fillOpacity: 0.6,
          weight: 2,
          opacity: 0.8
        }).bindPopup(`
          <div class="popup-cuadricula">
            <h4>Cuadrícula ${cuadricula.cuadriculaId}</h4>
            <div class="riesgo-badge riesgo-${cuadricula.nivelRiesgo}">
              <strong>Riesgo:</strong> ${cuadricula.nivelRiesgo.toUpperCase()}
            </div>
            <p><strong>Temperatura:</strong> ${cuadricula.temperatura.actual}°C</p>
            <p><strong>Viento:</strong> ${cuadricula.viento.velocidad} km/h</p>
            <p><strong>Precipitación:</strong> ${cuadricula.precipitacion} mm</p>
            <p><strong>Alertas:</strong> ${cuadricula.alertas.length > 0 ? cuadricula.alertas.join(', ') : 'Sin alertas activas'}</p>
            <p><strong>Última actualización:</strong> ${new Date(cuadricula.timestamp).toLocaleString()}</p>
          </div>
        `);
        
        // Agregar evento de clic para seleccionar la alerta
        marker.on('click', () => {
          console.log(`🎯 Cuadrícula seleccionada: ${cuadricula.cuadriculaId} (${cuadricula.nivelRiesgo})`);
          this.alertaSeleccionada.emit({
            id: cuadricula.cuadriculaId,
            tipo: 'cuadricula_meteorologica',
            nivel: cuadricula.nivelRiesgo,
            datos: cuadricula,
            coordenadas: cuadricula.centro
          });
        });
        
        marker.addTo(this.cuadriculasLayer!);
      } else {
        console.warn(`⚠️ Cuadrícula ${cuadricula.cuadriculaId} sin coordenadas de centro`);
      }
    });
    
    this.cuadriculasLayer.addTo(this.map);
    console.log(`✅ ${this.cuadriculas.length} cuadrículas pintadas en el mapa con diferentes colores`);
  }
  getColorPorRiesgo(nivel: string): string {
    switch (nivel) {
      case 'critico': return '#d32f2f';  // Rojo
      case 'alto': return '#ff9800';     // Naranja
      case 'moderado': return '#fbc02d'; // Amarillo
      case 'bajo': return '#4caf50';     // Verde
      default: return '#90caf9';         // Azul claro
    }
  }

  getRadiusPorRiesgo(nivel: string): number {
    switch (nivel) {
      case 'critico': return 18;   // Más grande para crítico
      case 'alto': return 15;      // Grande para alto
      case 'moderado': return 12;  // Mediano para moderado
      case 'bajo': return 8;       // Pequeño para bajo
      default: return 10;          // Tamaño por defecto
    }
  }
}
