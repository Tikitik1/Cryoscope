import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { ClimaService } from '../../services/clima.service';
import { GlaciarService } from '../../services/glaciar.service';
import { LayerControlService } from '../../services/layer-control.service';
import { InformacionService } from '../../services/informacion.service';
import { DatosClimaticos, GlaciarData } from '../../models/interfaces';
import { Subscription } from 'rxjs';

// Fix para iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

@Component({
  selector: 'app-map-central',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-central.component.html',
  styleUrls: ['./map-central.component.scss']
})
export class MapCentralComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  datosClimaticos: DatosClimaticos | null = null;
  glaciares: GlaciarData[] = [];
  cargandoDatos = true;
  errorCarga: string | null = null;
  
  // Mapa y capas
  private map: L.Map | null = null;
  private temperaturaLayer: L.GeoJSON | null = null;
  private glaciaresLayer: L.GeoJSON | L.LayerGroup | null = null;
  
  // Control de capas
  capaTemperaturaVisible = true;
  capaGlaciaresVisible = true;
  
  // Suscripciones para limpiar en ngOnDestroy
  private subscriptions: Subscription[] = [];

  constructor(
    private climaService: ClimaService,
    private glaciarService: GlaciarService,
    private layerControlService: LayerControlService,
    private informacionService: InformacionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarDatosIniciales();
    
    // Suscribirse a los cambios del control de capas
    const layerControlSub = this.layerControlService.layerState$.subscribe(state => {
      this.capaTemperaturaVisible = state.temperatura;
      this.capaGlaciaresVisible = state.icebergs;
      
      // Aplicar los cambios a las capas del mapa si están cargadas
      this.aplicarVisibilidadCapas();
    });
    
    this.subscriptions.push(layerControlSub);
  }

  ngAfterViewInit(): void {
    console.log('🔍 ngAfterViewInit llamado, verificando ViewChild...');
    
    // Delay más largo para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
      if (this.mapContainer && this.mapContainer.nativeElement) {
        console.log('✅ ViewChild mapContainer encontrado:', this.mapContainer.nativeElement);
        this.inicializarMapa();
      } else {
        console.log('⏳ ViewChild no disponible, intentando múltiples veces...');
        this.intentarInicializarMapa();
      }
    }, 500);
  }

  private intentarInicializarMapa(intentos: number = 0): void {
    const maxIntentos = 10;
    const delay = 250 + (intentos * 250);

    setTimeout(() => {
      if (this.mapContainer) {
        console.log(`✅ ViewChild encontrado en intento ${intentos + 1}`);
        this.inicializarMapa();
        return;
      }

      const mapContainerElement = document.getElementById('main-map-container');
      
      if (mapContainerElement) {
        console.log(`✅ Contenedor encontrado via getElementById en intento ${intentos + 1}`);
        this.inicializarMapa();
      } else if (intentos < maxIntentos - 1) {
        console.log(`⏳ Intento ${intentos + 1}/${maxIntentos} - Contenedor no encontrado, reintentando en ${delay + 250}ms...`);
        this.intentarInicializarMapa(intentos + 1);
      } else {
        console.error(`❌ CRÍTICO: No se pudo encontrar el contenedor del mapa después de ${maxIntentos} intentos`);
        this.errorCarga = 'Error crítico: No se pudo inicializar el mapa';
        this.cargandoDatos = false;
      }
    }, delay);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Carga los datos iniciales del clima y glaciares
   */
  private cargarDatosIniciales(): void {
    this.cargandoDatos = true;

    const climaSub = this.climaService.obtenerDatosClimaActuales().subscribe({
      next: (datos) => {
        this.datosClimaticos = datos;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando datos climáticos:', error);
        this.errorCarga = 'Error cargando datos climáticos';
        this.cargandoDatos = false;
      }
    });

    const glaciaresSub = this.glaciarService.obtenerGlaciares2022().subscribe({
      next: (glaciares) => {
        this.glaciares = glaciares;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando glaciares:', error);
        this.errorCarga = 'Error cargando datos de glaciares';
        this.cargandoDatos = false;
      }
    });

    this.subscriptions.push(climaSub, glaciaresSub);
  }

  /**
   * Verifica si todos los datos necesarios han sido cargados
   */
  private verificarCargaCompleta(): void {
    if (this.datosClimaticos && this.glaciares.length > 0) {
      this.cargandoDatos = false;
    }
  }

  /**
   * Inicializa el mapa con Leaflet y OpenStreetMap
   */
  private inicializarMapa(): void {
    console.log('🚀 Iniciando inicialización del mapa...');
    
    let mapContainerElement: HTMLElement | null = null;
    
    if (this.mapContainer && this.mapContainer.nativeElement) {
      mapContainerElement = this.mapContainer.nativeElement;
    } else {
      mapContainerElement = document.getElementById('main-map-container');
    }
    
    if (!mapContainerElement) {
      console.error('❌ CRÍTICO: No se encontró el contenedor del mapa');
      this.errorCarga = 'Error: Contenedor del mapa no encontrado';
      return;
    }

    if (mapContainerElement.offsetWidth === 0 || mapContainerElement.offsetHeight === 0) {
      console.warn('⚠️ El contenedor del mapa tiene dimensiones 0, esperando un momento más...');
      setTimeout(() => this.inicializarMapa(), 1000);
      return;
    }

    try {
      if (this.map) {
        this.map.remove();
        this.map = null;
      }

      this.map = L.map(mapContainerElement, {
        center: [-45.5, -72.0],
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
        preferCanvas: false,
        fadeAnimation: true,
        zoomAnimation: true
      });

      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
        minZoom: 3,
        crossOrigin: true
      });

      osmLayer.addTo(this.map);

      this.map.whenReady(() => {
        console.log('🎉 MAPA LISTO Y OPERATIVO!');
        if (this.map) {
          this.map.invalidateSize(true);
        }
      });

      const testMarker = L.marker([-45.5, -72.0])
        .addTo(this.map)
        .bindPopup('🗺️ Centro de la Región de Aysén<br>¡El mapa funciona correctamente!')
        .openPopup();

      setTimeout(() => {
        this.cargarCapasTemperatura();
        this.cargarCapaGlaciares();
        this.configurarControlCapas();
      }, 1000);

    } catch (error) {
      console.error('💥 Error fatal inicializando mapa:', error);
      this.errorCarga = 'Error fatal al inicializar el mapa';
    }
  }

  /**
   * Carga las capas de temperatura
   */
  private cargarCapasTemperatura(): void {
    if (!this.map) return;

    console.log('🌡️ Cargando datos de temperatura...');

    this.http.get('http://localhost:8000/api/temperatura/comunas/2020').subscribe({
      next: (data: any) => {
        if (data.features && Array.isArray(data.features)) {
          this.temperaturaLayer = L.geoJSON(data, {
            style: (feature) => {
              const temp = feature?.properties?.temperatura || 0;
              return {
                fillColor: this.getTemperatureColor(temp),
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.7
              };
            },
            onEachFeature: (feature, layer) => {
              const props = feature.properties;
              const temp = props.temperatura || 0;
              
              layer.on('click', () => {
                this.informacionService.mostrarInformacion({
                  tipo: 'temperatura',
                  data: {
                    nombre: props.nombre || 'Comuna',
                    temperatura: temp,
                    temperaturaActual: temp,
                    region: 'Aysén del Gral. Carlos Ibáñez del Campo'
                  }
                });
              });

              layer.on({
                mouseover: (e) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle({
                    weight: 3,
                    fillOpacity: 0.9
                  });
                },
                mouseout: (e) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle({
                    weight: 1,
                    fillOpacity: 0.7
                  });
                }
              });
            }
          });

          if (this.capaTemperaturaVisible && this.map) {
            this.temperaturaLayer.addTo(this.map);
            console.log(`✅ ${data.features.length} comunas con datos de temperatura cargadas`);
          }
        }
      },
      error: (error) => {
        console.error('❌ Error cargando temperatura de comunas:', error);
        this.cargarTemperaturaFallback();
      }
    });
  }

  /**
   * Fallback para cargar temperatura desde datos simulados
   */
  private cargarTemperaturaFallback(): void {
    if (!this.map) return;

    console.log('🔄 Cargando datos de temperatura simulados...');

    const datosComunasSimulados = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { nombre: "Coyhaique", temperatura: 8.5 },
          geometry: {
            type: "Polygon",
            coordinates: [[[-72.5, -45.4], [-72.3, -45.4], [-72.3, -45.6], [-72.5, -45.6], [-72.5, -45.4]]]
          }
        },
        {
          type: "Feature", 
          properties: { nombre: "Puerto Aysén", temperatura: 7.2 },
          geometry: {
            type: "Polygon",
            coordinates: [[[-72.8, -45.3], [-72.6, -45.3], [-72.6, -45.5], [-72.8, -45.5], [-72.8, -45.3]]]
          }
        },
        {
          type: "Feature",
          properties: { nombre: "Villa O'Higgins", temperatura: 6.8 },
          geometry: {
            type: "Polygon", 
            coordinates: [[[-72.9, -48.4], [-72.7, -48.4], [-72.7, -48.6], [-72.9, -48.6], [-72.9, -48.4]]]
          }
        }
      ]
    };

    this.temperaturaLayer = L.geoJSON(datosComunasSimulados as any, {
      style: (feature) => {
        const temp = feature?.properties?.temperatura || 0;
        return {
          fillColor: this.getTemperatureColor(temp),
          weight: 1,
          opacity: 1,
          color: 'white',
          fillOpacity: 0.7
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const temp = props.temperatura || 0;
        
        layer.on('click', () => {
          this.informacionService.mostrarInformacion({
            tipo: 'temperatura',
            data: {
              nombre: props.nombre || 'Comuna',
              temperatura: temp,
              temperaturaActual: temp,
              region: 'Aysén del Gral. Carlos Ibáñez del Campo'
            }
          });
        });
      }
    });
    
    if (this.capaTemperaturaVisible && this.map) {
      this.temperaturaLayer.addTo(this.map);
    }

    console.log('✅ Datos de temperatura simulados cargados');
  }

  /**
   * Carga la capa de glaciares desde el backend optimizado
   */
  private cargarCapaGlaciares(): void {
    if (!this.map) return;

    console.log('🏔️ Cargando glaciares de la región de Aysén...');

    this.http.get<any>('http://localhost:8000/api/icebergs').subscribe({
      next: (data) => {
        console.log('📦 Datos recibidos del backend:', data);

        if (data.features && Array.isArray(data.features)) {
          this.glaciaresLayer = L.geoJSON(data, {
            style: (feature) => ({
              fillColor: '#87CEEB',
              weight: 2,
              opacity: 0.8,
              color: '#4682B4',
              fillOpacity: 0.6
            }),
            onEachFeature: (feature, layer) => {
              const props = feature.properties;
              
              layer.on('click', () => {
                this.informacionService.mostrarInformacion({
                  tipo: 'glaciar',
                  data: {
                    nombre: props.nombre || 'Glaciar',
                    tipo: props.tipo || 'Glaciar',
                    region: 'Aysén del Gral. Carlos Ibáñez del Campo',
                    cuenca: props.cuenca || 'No especificada',
                    estado: 'Activo',
                    codigo: props.codigo || 'N/A',
                    area_km2: props.area_km2 || 0,
                    area_formatted: `${props.area_km2?.toFixed(2) || 0} km²`,
                    volumen_estimado_km3: props.volumen_estimado_km3 || 0,
                    volumen_formatted: `${props.volumen_estimado_km3?.toFixed(2) || 0} km³`,
                    latitud: props.latitud || 0,
                    longitud: props.longitud || 0,
                    coordenadas_formatted: `${props.latitud?.toFixed(4) || 0}°, ${props.longitud?.toFixed(4) || 0}°`,
                    clasificacion: props.clasificacion || 'No clasificado',
                    area: `${props.area_km2?.toFixed(2) || 0} km²`,
                    coordenadas: `${props.latitud?.toFixed(4) || 0}°, ${props.longitud?.toFixed(4) || 0}°`
                  }
                });
              });

              layer.on({
                mouseover: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    weight: 3,
                    fillOpacity: 0.8,
                    color: '#1e3a8a'
                  });
                },
                mouseout: (e) => {
                  const layer = e.target;
                  layer.setStyle({
                    weight: 2,
                    fillOpacity: 0.6,
                    color: '#4682B4'
                  });
                }
              });
            }
          });

          if (this.capaGlaciaresVisible && this.map) {
            this.glaciaresLayer.addTo(this.map);
            console.log(`✅ ${data.features.length} glaciares de Aysén cargados como polígonos`);
          }

          if (this.glaciaresLayer && data.features.length > 0) {
            setTimeout(() => {
              if (this.map && this.glaciaresLayer) {
                this.map.fitBounds((this.glaciaresLayer as L.GeoJSON).getBounds(), {
                  padding: [20, 20]
                });
              }
            }, 1000);
          }
        } else {
          console.warn('⚠️ No se encontraron features en la respuesta');
          this.cargarGlaciaresSimulados();
        }
      },
      error: (error) => {
        console.error('❌ Error cargando glaciares desde backend:', error);
        this.cargarGlaciaresSimulados();
      }
    });
  }

  /**
   * Fallback: cargar glaciares simulados
   */
  private cargarGlaciaresSimulados(): void {
    if (!this.map) return;

    this.glaciaresLayer = L.layerGroup() as any;

    const glaciares = [
      { lat: -45.3, lng: -72.2, name: "Glaciar A-1", size: "Grande" },
      { lat: -45.7, lng: -71.8, name: "Glaciar B-2", size: "Mediano" },
      { lat: -45.9, lng: -72.4, name: "Glaciar C-3", size: "Pequeño" }
    ];

    glaciares.forEach(glaciar => {
      const marker = L.marker([glaciar.lat, glaciar.lng], {
        icon: L.divIcon({
          className: 'glaciar-marker',
          html: '🏔️',
          iconSize: [20, 20]
        })
      });

      marker.on('click', () => {
        this.informacionService.mostrarInformacion({
          tipo: 'glaciar',
          data: {
            nombre: glaciar.name,
            area: glaciar.size === 'Grande' ? '50.2 km²' : glaciar.size === 'Mediano' ? '25.8 km²' : '12.1 km²',
            tipo: 'Glaciar de montaña',
            cuenca: 'Cuenca simulada',
            estado: 'Simulado',
            coordenadas: `${glaciar.lat.toFixed(2)}°, ${glaciar.lng.toFixed(2)}°`,
            region: 'Aysén del Gral. Carlos Ibáñez del Campo'
          }
        });
      });

      (this.glaciaresLayer as any)!.addLayer(marker);
    });

    if (this.capaGlaciaresVisible) {
      (this.glaciaresLayer as any).addTo(this.map);
    }
  }

  /**
   * Configura el control de capas
   */
  private configurarControlCapas(): void {
    // Control de capas manejado desde el sidebar
  }

  /**
   * Toggle de visibilidad de capas
   */
  toggleCapaTemperatura(): void {
    this.layerControlService.toggleTemperatura();
  }

  toggleCapaGlaciares(): void {
    this.layerControlService.toggleIcebergs();
  }

  /**
   * Obtiene el color de temperatura basado en el valor
   */
  getTemperatureColor(temp: number): string {
    if (temp < 0) return '#2196F3'; // Azul
    if (temp < 5) return '#4CAF50'; // Verde
    if (temp < 10) return '#FF9800'; // Naranja
    return '#F44336'; // Rojo
  }

  /**
   * Formatea la dirección del viento
   */
  getWindDirection(degrees: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  /**
   * Recarga los datos
   */
  recargarDatos(): void {
    this.errorCarga = null;
    this.cargarDatosIniciales();
  }

  /**
   * Calcula el área total de glaciares
   */
  getAreaTotal(): number {
    return this.glaciares.reduce((sum, g) => sum + g.area, 0) / 1000000;
  }

  /**
   * Calcula el volumen total estimado
   */
  getVolumenTotal(): number {
    return this.glaciares.reduce((sum, g) => sum + g.volumen, 0) / 1000000;
  }

  /**
   * Aplica la visibilidad de las capas según el estado del servicio
   */
  private aplicarVisibilidadCapas(): void {
    if (!this.map) return;

    // Aplicar visibilidad de la capa de temperatura
    if (this.temperaturaLayer) {
      if (this.capaTemperaturaVisible) {
        if (!this.map.hasLayer(this.temperaturaLayer)) {
          this.temperaturaLayer.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(this.temperaturaLayer)) {
          this.map.removeLayer(this.temperaturaLayer);
        }
      }
    }

    // Aplicar visibilidad de la capa de glaciares
    if (this.glaciaresLayer) {
      if (this.capaGlaciaresVisible) {
        if (!this.map.hasLayer(this.glaciaresLayer)) {
          this.glaciaresLayer.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(this.glaciaresLayer)) {
          this.map.removeLayer(this.glaciaresLayer);
        }
      }
    }
  }
}
