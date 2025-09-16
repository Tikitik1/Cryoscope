import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { ClimaService } from '../../services/clima.service';
import { ClimaComplementarioService, DatosClimaComplementarios } from '../../services/clima-complementario.service';
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
  datosClimaComplementarios: DatosClimaComplementarios[] = [];
  glaciares: GlaciarData[] = [];
  cargandoDatos = true;
  errorCarga: string | null = null;  // Mapa y capas
  private map: L.Map | null = null;
  private temperaturaLayer: L.GeoJSON | null = null;
  private glaciaresLayer: L.GeoJSON | L.LayerGroup | null = null;
  private pinturasRupestresLayer: L.GeoJSON | null = null;
  private demLayer: L.TileLayer | null = null;
  private climaLayer: L.GeoJSON | null = null;
    // Control de capas
  capaTemperaturaVisible = true;
  capaGlaciaresVisible = true;
  capaPinturasRupestresVisible = true;
  capaDEMVisible = false; // Inicialmente oculta
  capaClimaVisible = false; // Inicialmente oculta
  
  // Suscripciones para limpiar en ngOnDestroy
  private subscriptions: Subscription[] = [];
  constructor(
    private climaService: ClimaService,
    private climaComplementarioService: ClimaComplementarioService,
    private glaciarService: GlaciarService,
    private layerControlService: LayerControlService,
    private informacionService: InformacionService,
    private http: HttpClient
  ) {}
  ngOnInit(): void {
    this.cargarDatosIniciales();    // Suscribirse a los cambios del control de capas
    const layerControlSub = this.layerControlService.layerState$.subscribe(state => {
      console.log('🔄 MapCentral: Estado de capas actualizado:', state);
      this.capaTemperaturaVisible = state.temperatura;
      this.capaGlaciaresVisible = state.icebergs;
      this.capaPinturasRupestresVisible = state.pinturasRupestres;
      this.capaDEMVisible = state.dem || false;
      this.capaClimaVisible = state.clima || false;
      
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
    });    const glaciaresSub = this.glaciarService.obtenerGlaciares2022().subscribe({
      next: (glaciares) => {
        this.glaciares = glaciares;
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando glaciares:', error);
        this.errorCarga = 'Error cargando datos de glaciares';
        this.cargandoDatos = false;
      }
    });    const climaComplementarioSub = this.climaComplementarioService.obtenerDatosClimaComplementarios().subscribe({
      next: (datos) => {
        this.datosClimaComplementarios = datos;
        console.log('🌤️ Datos climáticos complementarios cargados:', datos);
        
        // Cargar la capa de clima si el mapa ya está inicializado
        if (this.map) {
          this.cargarCapaClima();
        }
        
        this.verificarCargaCompleta();
      },
      error: (error) => {
        console.error('Error cargando datos climáticos complementarios:', error);
        // No marcar como error crítico, ya que es una capa complementaria
        this.datosClimaComplementarios = [];
        this.verificarCargaCompleta();
      }
    });

    this.subscriptions.push(climaSub, glaciaresSub, climaComplementarioSub);
  }
  /**
   * Verifica si todos los datos necesarios han sido cargados
   */
  private verificarCargaCompleta(): void {
    if (this.datosClimaticos && this.glaciares.length > 0) {
      this.cargandoDatos = false;
      console.log('✅ Todos los datos cargados correctamente');
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
      });      osmLayer.addTo(this.map);

      this.map.whenReady(() => {
        console.log('🎉 MAPA LISTO Y OPERATIVO!');
        if (this.map) {
          this.map.invalidateSize(true);
        }
      });

      const testMarker = L.marker([-45.5, -72.0])
        .addTo(this.map)
        .bindPopup('🗺️ Centro de la Región de Aysén<br>¡El mapa funciona correctamente!')
        .openPopup();      setTimeout(() => {
        this.cargarCapasTemperatura();
        this.cargarCapaGlaciares();
        this.cargarCapaPinturasRupestres();
        this.cargarCapaDEM();
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
    if (!this.map) return;    console.log('🌡️ Cargando datos completos de temperatura...');

    this.http.get('http://localhost:8000/api/temperatura/comunas/completo').subscribe({
      next: (data: any) => {
        if (data.features && Array.isArray(data.features)) {          this.temperaturaLayer = L.geoJSON(data, {
            style: (feature) => {
              const temp = feature?.properties?.temperatura_2020 || 0;
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
              
              layer.on('click', () => {
                this.informacionService.mostrarInformacion({
                  tipo: 'temperatura',
                  data: {
                    nombre: props.NOM_COMUNA || props.nombre || 'Comuna',
                    region: props.NOM_REGION || 'Aysén del Gral. Carlos Ibáñez del Campo',
                    // Temperaturas completas
                    temperatura_2020: props.temperatura_2020,
                    temperatura_2050: props.temperatura_2050,
                    temperatura_actual: props.temperatura_actual,
                    delta_temperatura: props.delta_temperatura,
                    // Para compatibilidad
                    temperatura: props.temperatura_2020,
                    temperaturaActual: props.temperatura_actual,
                    // Coordenadas
                    latitud: props.latitud,
                    longitud: props.longitud,
                    coordenadas: `${props.latitud?.toFixed(4) || 0}°, ${props.longitud?.toFixed(4) || 0}°`
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
              nombre: props.NOM_COMUNA || props.nombre || 'Comuna',
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
              const props = feature.properties;                layer.on('click', () => {
                this.informacionService.mostrarInformacion({
                  tipo: 'glaciar',
                  data: {
                    // Información básica
                    id: props.id,
                    nombre: props.nombre || 'Sin Nombre',
                    area_km2: props.area_km2 || 0,
                    volumen_km3: props.volumen_km3 || 0,
                    clasificacion: props.clasificacion || 'No clasificado',
                    frente_termina_en: props.frente_termina_en || 'No especificado',
                    
                    // Alturas en metros
                    altura_media_m: props.altura_media_m,
                    altura_maxima_m: props.altura_maxima_m,
                    altura_minima_m: props.altura_minima_m,
                    
                    // Información adicional
                    orientacion: props.orientacion || 'N/A',
                    pendiente_grados: props.pendiente_grados,
                    latitud: props.latitud || 0,
                    longitud: props.longitud || 0,
                    region: props.region || 'Aysén del Gral. Carlos Ibáñez del Campo',
                    comuna: props.comuna || 'No especificada',
                      // Geometría para visualización 3D en Cesium
                    geometry: feature.geometry,
                    geometria: feature.geometry,
                    
                    // Para compatibilidad con el template existente
                    tipo: props.clasificacion || 'Glaciar',
                    codigo: props.id || 'N/A',
                    estado: 'Activo',
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
      { 
        lat: -45.3, 
        lng: -72.2, 
        name: "Glaciar A-1", 
        size: "Grande",
        area_km2: 50.2,
        altura_media_m: 1500,
        altura_maxima_m: 2200,
        altura_minima_m: 800
      },
      { 
        lat: -45.7, 
        lng: -71.8, 
        name: "Glaciar B-2", 
        size: "Mediano",
        area_km2: 25.8,
        altura_media_m: 1200,
        altura_maxima_m: 1800,
        altura_minima_m: 600
      },
      { 
        lat: -45.9, 
        lng: -72.4, 
        name: "Glaciar C-3", 
        size: "Pequeño",
        area_km2: 12.1,
        altura_media_m: 1000,
        altura_maxima_m: 1500,
        altura_minima_m: 500
      }
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
        // Crear una geometría simulada para la visualización 3D
        const simulatedGeometry = {
          type: "Polygon",
          coordinates: [[
            [glaciar.lng - 0.02, glaciar.lat - 0.02],
            [glaciar.lng + 0.02, glaciar.lat - 0.02],
            [glaciar.lng + 0.02, glaciar.lat + 0.02],
            [glaciar.lng - 0.02, glaciar.lat + 0.02],
            [glaciar.lng - 0.02, glaciar.lat - 0.02]
          ]]
        };

        this.informacionService.mostrarInformacion({
          tipo: 'glaciar',
          data: {
            nombre: glaciar.name,
            area_km2: glaciar.area_km2,
            altura_media_m: glaciar.altura_media_m,
            altura_maxima_m: glaciar.altura_maxima_m,
            altura_minima_m: glaciar.altura_minima_m,
            latitud: glaciar.lat,
            longitud: glaciar.lng,
            geometry: simulatedGeometry,
            area: `${glaciar.area_km2} km²`,
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
   * Carga la capa de pinturas rupestres desde el backend
   */
  private cargarCapaPinturasRupestres(): void {
    if (!this.map) return;

    console.log('🎨 Cargando pinturas rupestres de la región de Aysén...');

    this.http.get<any>('http://localhost:8000/api/pinturas-rupestres').subscribe({
      next: (data) => {
        console.log('🎨 Datos de pinturas rupestres recibidos:', data);        if (data.features && Array.isArray(data.features)) {
          // Crear una capa GeoJSON fija como los shapefiles
          this.pinturasRupestresLayer = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
              // Crear un círculo fijo en lugar de marcador movible
              return L.circleMarker(latlng, {
                radius: 8,
                fillColor: '#8B4513',
                color: '#654321',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
                // Asegurar que sea completamente fijo
                interactive: true,
                bubblingMouseEvents: false
              });
            },
            onEachFeature: (feature, layer) => {
              const props = feature.properties;
              const geometry = feature.geometry;
              
              if (geometry && geometry.type === 'Point') {
                const [lng, lat] = geometry.coordinates;
                
                // Popup con información básica
                const popupContent = `
                  <div class="pintura-popup">
                    <h4>🎨 ${props.nombre || props.NOMBRE || props.Name || 'Sitio Rupestre'}</h4>
                    <p><strong>Tipo:</strong> ${props.tipo_sitio || props.tipo || 'Pintura Rupestre'}</p>
                    <p><strong>Patrimonio:</strong> ${props.patrimonio || 'Cultural'}</p>
                    <p><strong>Región:</strong> ${props.region || 'Aysén'}</p>
                    <p><strong>Coordenadas:</strong> ${lat?.toFixed(4) || 0}°, ${lng?.toFixed(4) || 0}°</p>
                  </div>
                `;
                layer.bindPopup(popupContent);                // Click para mostrar información completa en el sidebar
                layer.on('click', (e) => {
                  // Prevenir completamente la propagación del evento
                  L.DomEvent.stopPropagation(e);
                  
                  this.informacionService.mostrarInformacion({
                    tipo: 'pinturaRupestre',
                    data: {
                      nombre: props.nombre || props.NOMBRE || props.Name || 'Sitio Rupestre',
                      tipo_sitio: props.tipo_sitio || props.tipo || 'Pintura Rupestre',
                      region: props.region || 'Aysén del Gral. Carlos Ibáñez del Campo',
                      patrimonio: props.patrimonio || 'Cultural',
                      latitud: lat,
                      longitud: lng,
                      coordenadas: `${lat?.toFixed(4) || 0}°, ${lng?.toFixed(4) || 0}°`,
                      // Agregar todas las propiedades originales
                      ...props
                    }
                  });
                });                // Efectos de hover similares a los glaciares y temperaturas
                layer.on({
                  mouseover: (e) => {
                    const targetLayer = e.target;
                    targetLayer.setStyle({
                      fillOpacity: 1,
                      weight: 3,
                      color: '#FF6B35'
                    });
                  },
                  mouseout: (e) => {
                    const targetLayer = e.target;
                    targetLayer.setStyle({
                      fillOpacity: 0.8,
                      weight: 2,
                      color: '#654321'
                    });
                  }
                });
              }
            }
          });

          if (this.capaPinturasRupestresVisible && this.map) {
            this.pinturasRupestresLayer.addTo(this.map);
            console.log(`✅ ${data.features.length} pinturas rupestres cargadas como capa GeoJSON fija`);
          }
        } else {
          console.warn('⚠️ No se encontraron features de pinturas rupestres en la respuesta');
        }
      },
      error: (error) => {
        console.error('❌ Error cargando pinturas rupestres desde backend:', error);
        this.cargarPinturasRupestresSimuladas();
      }
    });
  }

  /**
   * Fallback: cargar pinturas rupestres simuladas
   */  private cargarPinturasRupestresSimuladas(): void {
    if (!this.map) return;

    console.log('🔄 Cargando pinturas rupestres simuladas...');    // Crear datos GeoJSON simulados
    const pinturasGeoJSON: any = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {
            ID_SITIO: "PR001",
            NOMBRE: "Cueva de las Manos Simulada",
            DESCRIPCION: "Pinturas rupestres con motivos geométricos",
            FECHA_DESCUBRIMIENTO: "1985",
            ESTADO_CONSERVACION: "Bueno",
            TIPO: "Pintura Rupestre"
          },
          geometry: {
            type: "Point" as const,
            coordinates: [-72.1, -45.2]
          }
        },
        {
          type: "Feature" as const, 
          properties: {
            ID_SITIO: "PR002",
            NOMBRE: "Sitio Arqueológico A",
            DESCRIPCION: "Arte rupestre con representaciones de guanacos",
            FECHA_DESCUBRIMIENTO: "1992",
            ESTADO_CONSERVACION: "Regular",
            TIPO: "Petroglifo"
          },
          geometry: {
            type: "Point" as const,
            coordinates: [-71.9, -45.8]
          }
        },
        {
          type: "Feature" as const,
          properties: {
            ID_SITIO: "PR003",
            NOMBRE: "Arte Rupestre B",
            DESCRIPCION: "Impresiones de manos y figuras antropomorfas",
            FECHA_DESCUBRIMIENTO: "1978", 
            ESTADO_CONSERVACION: "Excelente",
            TIPO: "Pintura Rupestre"
          },
          geometry: {
            type: "Point" as const,
            coordinates: [-72.3, -45.6]
          }
        }
      ]
    };

    this.pinturasRupestresLayer = L.geoJSON(pinturasGeoJSON, {      pointToLayer: (feature: any, latlng: L.LatLng) => {
        // Crear un círculo completamente fijo como los shapefiles
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: '#8B4513',
          color: '#654321',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          interactive: true,
          bubblingMouseEvents: false
        });
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const popup = `
          <div class="popup-content">
            <h4>🎨 ${feature.properties.NOMBRE || 'Sitio sin nombre'}</h4>
            <p><strong>ID:</strong> ${feature.properties.ID_SITIO || 'N/A'}</p>
            <p><strong>Tipo:</strong> ${feature.properties.TIPO || 'N/A'}</p>
            <p><strong>Descripción:</strong> ${feature.properties.DESCRIPCION || 'Sin descripción'}</p>
            <p><strong>Estado:</strong> ${feature.properties.ESTADO_CONSERVACION || 'N/A'}</p>
          </div>
        `;
        layer.bindPopup(popup);
          layer.on('click', (e: L.LeafletMouseEvent) => {
          // Detener completamente la propagación para evitar cualquier movimiento
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
          
          this.informacionService.mostrarInformacion({
            tipo: 'pinturaRupestre',
            data: {
              id: feature.properties.ID_SITIO || 'N/A',
              nombre: feature.properties.NOMBRE || 'Sitio sin nombre',
              descripcion: feature.properties.DESCRIPCION || 'Sin descripción',
              fechaDescubrimiento: feature.properties.FECHA_DESCUBRIMIENTO || 'N/A',
              estadoConservacion: feature.properties.ESTADO_CONSERVACION || 'N/A',
              tipo: feature.properties.TIPO || 'N/A'
            }
          });
        });        // Efectos de hover
        layer.on({
          mouseover: (e) => {
            const targetLayer = e.target as L.CircleMarker;
            targetLayer.setStyle({
              fillOpacity: 1,
              weight: 3,
              color: '#FF6B35'
            });
          },
          mouseout: (e) => {
            const targetLayer = e.target as L.CircleMarker;
            targetLayer.setStyle({
              fillOpacity: 0.8,
              weight: 2,
              color: '#654321'
            });
          }
        });
      }
    });

    if (this.capaPinturasRupestresVisible && this.map) {
      this.pinturasRupestresLayer.addTo(this.map);
      console.log('✅ Pinturas rupestres simuladas cargadas');
    }
  }  /**
   * Carga la capa de datos climáticos complementarios usando shapefiles de comunas
   */
  private cargarCapaClima(): void {
    if (!this.map) {
      console.log('⚠️ Mapa no está inicializado, no se puede cargar capa de clima');
      return;
    }
    
    if (this.datosClimaComplementarios.length === 0) {
      console.log('⚠️ No hay datos climáticos complementarios disponibles');
      return;
    }

    console.log('🌤️ Cargando capa de clima complementario con shapefiles de comunas...');

    // Crear un mapa de datos climáticos por comuna para búsqueda rápida
    const datosClimaMap = new Map<string, DatosClimaComplementarios>();
    this.datosClimaComplementarios.forEach(clima => {
      const nombreNormalizado = this.normalizarNombreComuna(clima.comuna);
      datosClimaMap.set(nombreNormalizado, clima);
    });

    // Cargar GeoJSON de comunas desde el backend
    this.http.get('http://localhost:8000/api/temperatura/comunas/completo').subscribe({
      next: (data: any) => {
        if (data.features && Array.isArray(data.features)) {
          this.climaLayer = L.geoJSON(data, {
            style: (feature) => {
              const nombreComuna = feature?.properties?.NOM_COMUNA || feature?.properties?.nombre || '';
              const nombreNormalizado = this.normalizarNombreComuna(nombreComuna);
              const datosClima = datosClimaMap.get(nombreNormalizado);
              
              if (datosClima) {
                // Color basado en precipitación
                const color = this.climaComplementarioService.getColorPrecipitacion(datosClima.precipitacion_mm);
                return {
                  fillColor: color,
                  weight: 2,
                  opacity: 1,
                  color: '#ffffff',
                  fillOpacity: 0.7
                };
              } else {
                // Color por defecto para comunas sin datos
                return {
                  fillColor: '#f5f5f5',
                  weight: 1,
                  opacity: 1,
                  color: '#cccccc',
                  fillOpacity: 0.3
                };
              }
            },
            onEachFeature: (feature, layer) => {
              const nombreComuna = feature?.properties?.NOM_COMUNA || feature?.properties?.nombre || '';
              const nombreNormalizado = this.normalizarNombreComuna(nombreComuna);
              const datosClima = datosClimaMap.get(nombreNormalizado);
                if (datosClima) {
                // Popup simplificado con información clave
                const popupContent = `
                  <div class="clima-popup">
                    <h4>🌤️ ${datosClima.comuna}</h4>
                    <div class="clima-datos-principales">
                      <div class="dato-principal">
                        <span class="icono">💧</span>
                        <span class="valor">${datosClima.precipitacion_mm.toFixed(1)} mm</span>
                        <span class="etiqueta">Precipitación</span>
                      </div>
                      <div class="dato-principal">
                        <span class="icono">💨</span>
                        <span class="valor">${datosClima.humedad_relativa.toFixed(0)}%</span>
                        <span class="etiqueta">Humedad</span>
                      </div>
                      <div class="dato-principal">
                        <span class="icono">🌬️</span>
                        <span class="valor">${datosClima.velocidad_viento.toFixed(1)} km/h</span>
                        <span class="etiqueta">Viento</span>
                      </div>
                      <div class="dato-principal">
                        <span class="icono">🌡️</span>
                        <span class="valor">${datosClima.sensacion_termica.toFixed(1)}°C</span>
                        <span class="etiqueta">Sensación</span>
                      </div>
                    </div>
                    <small style="color: #666;">Haz clic para más detalles</small>
                  </div>
                `;
                layer.bindPopup(popupContent);

                // Click para mostrar información en el sidebar
                layer.on('click', () => {
                  this.informacionService.mostrarInformacion({
                    tipo: 'clima',
                    data: {
                      comuna: datosClima.comuna,
                      precipitacion: datosClima.precipitacion_mm,
                      humedad: datosClima.humedad_relativa,
                      radiacion: datosClima.radiacion_solar,
                      viento_velocidad: datosClima.velocidad_viento,
                      viento_direccion: datosClima.direccion_viento,
                      presion: datosClima.presion_atmosferica,
                      uv: datosClima.indice_uv,
                      visibilidad: datosClima.visibilidad,
                      nubosidad: datosClima.nubosidad,
                      punto_rocio: datosClima.punto_rocio,
                      sensacion_termica: datosClima.sensacion_termica
                    }
                  });
                });
              } else {
                // Para comunas sin datos climáticos
                const popupContent = `
                  <div class="clima-popup">
                    <h4>🌤️ ${nombreComuna}</h4>
                    <p>No hay datos climáticos disponibles para esta comuna.</p>
                  </div>
                `;
                layer.bindPopup(popupContent);
              }

              // Efectos de hover
              layer.on({
                mouseover: (e) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle({
                    weight: 4,
                    fillOpacity: 0.9
                  });
                },
                mouseout: (e) => {
                  const targetLayer = e.target;
                  targetLayer.setStyle({
                    weight: 2,
                    fillOpacity: 0.7
                  });
                }
              });
            }
          });

          if (this.capaClimaVisible && this.map) {
            this.climaLayer.addTo(this.map);
            console.log('✅ Capa de clima complementario cargada con shapefiles de comunas');
          }
        } else {
          console.warn('⚠️ No se encontraron features en la respuesta de comunas');
        }
      },
      error: (error) => {
        console.error('❌ Error cargando shapefiles de comunas para clima:', error);
      }
    });
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

  toggleCapaPinturasRupestres(): void {
    this.layerControlService.togglePinturasRupestres();
  }

  toggleCapaDEM(): void {
    this.layerControlService.toggleDEM();
  }

  toggleCapaClima(): void {
    this.layerControlService.toggleClima();
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
    }    // Aplicar visibilidad de la capa de pinturas rupestres
    if (this.pinturasRupestresLayer) {
      if (this.capaPinturasRupestresVisible) {
        if (!this.map.hasLayer(this.pinturasRupestresLayer)) {
          this.pinturasRupestresLayer.addTo(this.map);
        }
      } else {
        if (this.map.hasLayer(this.pinturasRupestresLayer)) {
          this.map.removeLayer(this.pinturasRupestresLayer);
        }
      }
    }    // Aplicar visibilidad de la capa DEM
    if (this.demLayer) {
      if (this.capaDEMVisible) {
        if (!this.map.hasLayer(this.demLayer)) {
          this.demLayer.addTo(this.map);
          console.log('✅ Capa DEM agregada al mapa');
        }
      } else {
        if (this.map.hasLayer(this.demLayer)) {
          this.map.removeLayer(this.demLayer);
          console.log('❌ Capa DEM removida del mapa');
        }
      }    } else {
      console.log('⚠️ Capa DEM no está inicializada');
    }    // Aplicar visibilidad de la capa de clima
    if (this.climaLayer) {
      if (this.capaClimaVisible) {
        if (!this.map.hasLayer(this.climaLayer)) {
          this.climaLayer.addTo(this.map);
          console.log('✅ Capa de clima agregada al mapa');
        }
      } else {
        if (this.map.hasLayer(this.climaLayer)) {
          this.map.removeLayer(this.climaLayer);
          console.log('❌ Capa de clima removida del mapa');
        }
      }
    } else if (this.capaClimaVisible) {
      // Si se intenta mostrar la capa pero no está inicializada, intentar cargarla
      console.log('🔄 Intentando cargar capa de clima...');
      this.cargarCapaClima();
    }
  }
  /**
   * Normaliza el nombre de una comuna para hacer coincidencias
   */
  private normalizarNombreComuna(nombre: string): string {
    const normalizado = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
    
    // Mapeo específico para casos especiales
    const mapeoEspecial: { [key: string]: string } = {
      'puerto aysen': 'aysen',
      'villa o higgins': 'o higgins',
      'ohiggins': 'o higgins',
      'rio ibanez': 'rio ibanez',
      'chile chico': 'chile chico',
      'coyhaique': 'coyhaique',
      'cochrane': 'cochrane',
      'guaitecas': 'guaitecas',
      'cisnes': 'cisnes',
      'lago verde': 'lago verde',
      'tortel': 'tortel'
    };
    
    return mapeoEspecial[normalizado] || normalizado;
  }

  /**
   * Carga la capa DEM (Elevación)
   */
  private cargarCapaDEM(): void {
    if (!this.map) return;
    
    if (!this.demLayer) {
      console.log('🏔️ Creando capa DEM...');
      // Crear capa DEM (OpenTopoMap) limitada a la región de Aysén
      this.demLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenTopoMap (CC-BY-SA)',
        bounds: [[-49.5, -75.0], [-43.0, -70.0]], // Límites aproximados de la región de Aysén
        opacity: 0.7
      });
      
      console.log('✅ Capa DEM creada');
    }
    
    // Solo agregar si debe estar visible
    if (this.capaDEMVisible && this.demLayer && !this.map.hasLayer(this.demLayer)) {
      this.demLayer.addTo(this.map);
      console.log('✅ Capa DEM agregada al mapa');
    }
  }
}
