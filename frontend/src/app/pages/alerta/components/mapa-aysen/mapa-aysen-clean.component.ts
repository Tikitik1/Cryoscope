import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';

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
        <h3>Región de Aysén - Monitoreo de Glaciares</h3>        <div class="controles-mapa">
          <button class="btn-control" (click)="cargarDatosReales()" title="Cargar datos desde backend">
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
          <p><strong>Elevación:</strong> {{glaciarSeleccionado.elevacion}} m</p>
          <p><strong>Estado:</strong> 
            <span [class]="'estado-' + glaciarSeleccionado.estado.toLowerCase()">
              {{glaciarSeleccionado.estado}}
            </span>
          </p>
          <p><strong>Última medición:</strong> {{glaciarSeleccionado.ultimaMedicion | date:'short'}}</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./mapa-aysen.component.scss']
})
export class MapaAysenComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapaContainer', { static: false }) mapaContainer!: ElementRef;
    private map: L.Map | null = null;
  private glaciaresLayer: L.GeoJSON | null = null; // Capa para shapefiles de glaciares
  private subscriptions: Subscription[] = [];
  private readonly API_BASE = 'http://localhost:8000/api';
  
  glaciarSeleccionado: any = null;
  glaciares: any[] = []; // Se cargarán desde el backend

  constructor(
    private http: HttpClient
  ) {}
  ngOnInit() {
    console.log('🗺️ Mapa de Aysén inicializado');
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.inicializarMapa();
      this.cargarDatosReales();
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.map) {
      this.map.remove();
    }
  }
  /**
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
   */
  private cargarDatosFallback() {
    console.log('🔄 Cargando datos de fallback como shapefiles...');
    
    // GeoJSON simplificado de glaciares conocidos
    const fallbackGeoJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "nombre": "Glaciar San Rafael",
            "area_km2": 762.5,
            "volumen_km3": 234.8,
            "altura_media": 1500,
            "clasificacion": "Glaciar de marea",
            "frente_termina": "Mar"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [-73.85, -46.67], [-73.82, -46.67], [-73.82, -46.70], [-73.85, -46.70], [-73.85, -46.67]
            ]]
          }
        },
        {
          "type": "Feature", 
          "properties": {
            "nombre": "Glaciar Jorge Montt",
            "area_km2": 543.2,
            "volumen_km3": 187.6,
            "altura_media": 1200,
            "clasificacion": "Glaciar de montaña",
            "frente_termina": "Lago"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [-73.55, -48.00], [-73.52, -48.00], [-73.52, -48.03], [-73.55, -48.03], [-73.55, -48.00]
            ]]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "nombre": "Glaciar O'Higgins",
            "area_km2": 823.1,
            "volumen_km3": 412.7,
            "altura_media": 800,
            "clasificacion": "Glaciar de valle",
            "frente_termina": "Río"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [-72.93, -48.87], [-72.90, -48.87], [-72.90, -48.90], [-72.93, -48.90], [-72.93, -48.87]
            ]]
          }
        }
      ],
      "metadata": {
        "total": 3,
        "source": "Datos de fallback",
        "tipo": "fallback_geojson"
      }
    };
    
    // Agregar como capa de shapefiles
    this.agregarCapaGlaciares(fallbackGeoJSON);
    
    // Extraer información para el panel
    this.glaciares = fallbackGeoJSON.features.map((feature: any, index: number) => ({
      id: index,
      nombre: feature.properties.nombre,
      area: feature.properties.area_km2,
      elevacion: feature.properties.altura_media,
      estado: this.determinarEstadoGlaciar(feature.properties),
      lat: this.obtenerCentroide(feature.geometry).lat,
      lng: this.obtenerCentroide(feature.geometry).lng,
      volumen: feature.properties.volumen_km3,
      clasificacion: feature.properties.clasificacion,
      orientacion: 'N/A',
      frenteTermina: feature.properties.frente_termina,
      ultimaMedicion: new Date()
    }));
    
    console.log('✅ Datos de fallback cargados como shapefiles:', this.glaciares.length);
  }

  /**
   * Determina el estado del glaciar basado en sus propiedades
   */
  private determinarEstadoGlaciar(propiedades: any): string {
    // Lógica para determinar estado basado en datos reales
    if (propiedades.area_km2 > 50) {
      return 'Estable';
    } else if (propiedades.area_km2 > 10) {
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
    console.log('🏔️ Glaciar seleccionado:', glaciar);
    
    if (this.map) {
      this.map.setView([glaciar.lat, glaciar.lng], 10);
    }
  }
}
