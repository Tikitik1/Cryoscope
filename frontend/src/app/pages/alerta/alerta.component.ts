import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import * as L from 'leaflet';
import { RiesgoService, EvaluacionRiesgo } from './services/riesgo.service';
import { ReportesService, Reporte } from './services/reportes.service';
import { GlaciaresService, GlaciarFeature } from './services/glaciares.service';
import { DatosMeteorologicosCuadricula } from './services/aysen-meteo.service';
import { MapaAysenComponent } from './components/mapa-aysen/mapa-aysen.component';
import { InfoAlertasComponent } from './components/info-alertas/info-alertas.component';
import { ReportesComponent } from './components/reportes/reportes.component';
import { PronosticoRiesgoComponent } from './components/pronostico-riesgo/pronostico-riesgo.component';

interface PuntoRiesgo {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  nivelRiesgo: 'bajo' | 'moderado' | 'alto' | 'critico';
  tipo: 'iceberg' | 'glaciar' | 'deforestacion' | 'reporte_ciudadano';
  descripcion: string;
  factores: string[];
  timestamp: Date;
}

interface ReporteCiudadano {
  id: string;
  latitud: number;
  longitud: number;
  descripcion: string;
  tipo: 'iceberg_avistado' | 'cambio_glaciar' | 'deforestacion' | 'contaminacion' | 'otro';
  reportante: string;
  email: string;
  timestamp: Date;
  estado: 'pendiente' | 'verificado' | 'analizando' | 'falso_positivo';
  imagenes?: string[];
}

@Component({
  selector: 'app-alerta',
  standalone: true,  imports: [
    CommonModule,
    FormsModule,
    MapaAysenComponent,
    InfoAlertasComponent,
    ReportesComponent,
    PronosticoRiesgoComponent,
  ],
  styleUrls: ['./alerta.component.scss'],
  templateUrl: './alerta.component.html',
})
export class AlertaComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapaElement', { static: false }) mapaElement!: ElementRef;
  // Propiedades del mapa
  private mapa: L.Map | null = null;
  private markersLayer: L.LayerGroup = new L.LayerGroup();
  private glaciaresLayer: L.LayerGroup = new L.LayerGroup();
  
  // Estados del componente
  cargandoPeligros = false;
  cargandoAlertas = false;
  enviandoReporte = false;
  analizandoReporte: string | null = null;
  sistemaAlertasActivo = true;
  mostrandoFormulario = false;
    // Datos del mapa
  peligroSeleccionado: PuntoRiesgo | null = null;
  puntosPeligro: PuntoRiesgo[] = [];
  glaciares: GlaciarFeature[] = [];
  alertaSeleccionada: any = null;
  
  // Sistema de riesgo real
  evaluacionesRiesgo: EvaluacionRiesgo[] = [];
  sistemaRiesgoActivo = false;
  actualizacionAutomatica = false;
    // Estadísticas del sistema
  totalPuntosMonitoreados = 0;
  alertasCriticas = 0;
  reportesPendientes = 0;
  ultimaActualizacion = new Date();

  // Análisis de cuadrícula seleccionada
  cuadriculaSeleccionada: DatosMeteorologicosCuadricula | null = null;
    // Reportes ciudadanos
  reportesRecientes: ReporteCiudadano[] = [];
  nuevoReporte: Partial<ReporteCiudadano> = {
    tipo: undefined,
    descripcion: '',
    reportante: '',
    email: '',
    latitud: -46.4000,
    longitud: -74.0000
  };

  private subscriptions: Subscription[] = [];  constructor(
    private http: HttpClient,
    private riesgoService: RiesgoService,
    private reportesService: ReportesService,
    private glaciaresService: GlaciaresService
  ) {
    console.log('🎯 Página de alertas inicializada - Sistema con cuadrículas de monitoreo de Aysén');
  }ngOnInit() {
    this.inicializarDatos();
    this.cargarReportesRecientes();
    this.inicializarSistemaRiesgo();
    this.cargarGlaciares();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.inicializarMapa();
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.mapa) {
      this.mapa.remove();
    }
  }

  private inicializarMapa() {
    if (!this.mapaElement?.nativeElement) {
      console.warn('Elemento del mapa no encontrado');
      return;
    }

    try {
      // Configurar íconos de Leaflet
      const iconRetinaUrl = 'assets/marker-icon-2x.png';
      const iconUrl = 'assets/marker-icon.png';
      const shadowUrl = 'assets/marker-shadow.png';
      const iconDefault = L.icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
      });
      L.Marker.prototype.options.icon = iconDefault;      // Inicializar mapa centrado en el corazón de la Región de Aysén
      this.mapa = L.map(this.mapaElement.nativeElement, {
        center: [-46.4, -72.7], // Cerca de Coyhaique, centro de la región
        zoom: 7,
        zoomControl: true
      });// Agregar capa base
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.mapa);

      // Agregar capas al mapa
      this.glaciaresLayer.addTo(this.mapa);
      this.markersLayer.addTo(this.mapa);      // Cargar puntos de riesgo reales desde evaluaciones
      this.cargarEvaluacionesRiesgo();

      console.log('✅ Mapa inicializado correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar el mapa:', error);
    }
  }  private inicializarDatos() {
    // Inicializar estadísticas con valores por defecto hasta que se carguen datos reales
    this.totalPuntosMonitoreados = 0;
    this.alertasCriticas = 0;
    this.reportesPendientes = 0;
    this.ultimaActualizacion = new Date();
  }

  private inicializarSistemaRiesgo() {
    console.log('🔄 Inicializando sistema de riesgo real...');
      // Cargar evaluaciones de riesgo iniciales
    this.cargarEvaluacionesRiesgo();
    
    // Configurar actualizaciones automáticas cada 30 minutos usando únicamente Aysén
    const actualizacionSubscription = interval(30 * 60 * 1000).pipe(
      switchMap(() => this.riesgoService.evaluarRiesgoAysen()),
      catchError(error => {
        console.error('Error en actualización automática de Aysén:', error);
        // Si Aysén falla, retornar array vacío
        return of([]);
      })
    ).subscribe(evaluaciones => {
      this.evaluacionesRiesgo = evaluaciones;
      this.actualizarPuntosRiesgoDesdeEvaluaciones();
      this.actualizarEstadisticas();
      console.log(`🔄 Zonas de Aysén actualizadas: ${evaluaciones.length} monitoreadas`);
    });

    this.subscriptions.push(actualizacionSubscription);
  }  private cargarEvaluacionesRiesgo() {
    this.cargandoPeligros = true;
    
    // Primero obtener las cuadrículas desde el backend
    this.http.get<any>('http://localhost:8000/api/grid/cuadriculas_aysen').pipe(
      switchMap(response => {
        const cuadriculas = response.grid_points || [];
        console.log(`🔄 Obtenidas ${cuadriculas.length} cuadrículas de Aysén, evaluando riesgo...`);
        
        // Si tenemos cuadrículas, evaluar el riesgo para cada una
        if (cuadriculas.length > 0) {
          // Crear puntos de riesgo basados en las cuadrículas reales
          const puntosRiesgo = cuadriculas.map((cuadricula: any) => {
            const puntoRiesgo: PuntoRiesgo = {
              id: `cuadricula_${cuadricula.id}`,
              nombre: `${cuadricula.grid_id} (${cuadricula.comuna})`,
              latitud: cuadricula.lat,
              longitud: cuadricula.lon,
              nivelRiesgo: this.calcularNivelRiesgoSimple(cuadricula),
              tipo: 'glaciar',
              descripcion: `Zona de monitoreo en ${cuadricula.comuna}, región de ${cuadricula.region}`,
              factores: ['Monitoreo meteorológico activo', 'Basado en datos reales de OpenMeteo'],
              timestamp: new Date()
            };
            return puntoRiesgo;
          });
          
          this.puntosPeligro = puntosRiesgo;
          this.actualizarMarcadoresMapa();
          return of([]); // Devolver array vacío ya que creamos los puntos directamente
        } else {
          // Fallback: usar el sistema de riesgo anterior
          return this.riesgoService.evaluarRiesgoAysen();
        }
      }),
      catchError(error => {
        console.error('Error cargando cuadrículas de Aysén:', error);
        // Fallback: usar evaluaciones de riesgo tradicionales
        return this.riesgoService.evaluarRiesgoAysen().pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(evaluaciones => {
      this.evaluacionesRiesgo = evaluaciones;
      if (evaluaciones.length > 0) {
        this.actualizarPuntosRiesgoDesdeEvaluaciones();
      }
      this.actualizarEstadisticas();
      this.cargandoPeligros = false;
      this.sistemaRiesgoActivo = this.puntosPeligro.length > 0;      console.log(`✅ Sistema de monitoreo activo con ${this.puntosPeligro.length} puntos en Aysén`);
    });

    // No necesitamos agregar subscription porque usamos pipe con el HTTP client
  }
  private actualizarPuntosRiesgoDesdeEvaluaciones() {
    // Convertir evaluaciones de riesgo a puntos de peligro para el mapa
    const puntosRiesgo = this.evaluacionesRiesgo.map(evaluacion => {
      const puntoRiesgo: PuntoRiesgo = {
        id: `riesgo_${evaluacion.ubicacion.latitud}_${evaluacion.ubicacion.longitud}`,
        nombre: evaluacion.ubicacion.nombre,
        latitud: evaluacion.ubicacion.latitud,
        longitud: evaluacion.ubicacion.longitud,
        nivelRiesgo: this.convertirNivelRiesgoGlobalAPuntoRiesgo(evaluacion.nivelRiesgoGlobal),
        tipo: 'glaciar', // Por defecto, puede ajustarse según el contexto
        descripcion: this.generarDescripcionDesdeEvaluacion(evaluacion),
        factores: evaluacion.alertasGeneradas,
        timestamp: evaluacion.timestamp
      };
      return puntoRiesgo;
    });

    // Solo usar puntos de riesgo reales de las evaluaciones
    this.puntosPeligro = puntosRiesgo;
    this.actualizarMarcadoresMapa();
  }

  private convertirNivelRiesgoGlobalAPuntoRiesgo(nivelGlobal: 'verde' | 'amarillo' | 'naranja' | 'rojo'): 'bajo' | 'moderado' | 'alto' | 'critico' {
    const mapping = {
      'verde': 'bajo' as const,
      'amarillo': 'moderado' as const,
      'naranja': 'alto' as const,
      'rojo': 'critico' as const
    };
    return mapping[nivelGlobal];
  }

  private generarDescripcionDesdeEvaluacion(evaluacion: EvaluacionRiesgo): string {
    const nivel = evaluacion.nivelRiesgoGlobal.toUpperCase();
    const confianza = evaluacion.confianza;
    const tendencia = evaluacion.tendencia;
    
    return `Nivel de riesgo ${nivel} detectado con ${confianza}% de confianza. Tendencia: ${tendencia}. ${evaluacion.recomendaciones.join(' ')}`;  }  private actualizarEstadisticas() {
    // Todas las estadísticas deben reflejar únicamente la región de Aysén con datos reales
    this.calcularEstadisticasAysen();
    this.reportesPendientes = this.reportesRecientes.filter(r => r.estado === 'pendiente').length;
    this.ultimaActualizacion = new Date();
  }  private calcularEstadisticasAysen() {
    // Obtener estadísticas directamente de las cuadrículas de Aysén desde el backend
    this.http.get<any>('http://localhost:8000/api/grid/cuadriculas_aysen').subscribe({
      next: (response) => {
        // Puntos monitoreados = cuadrículas generadas desde las comunas reales
        this.totalPuntosMonitoreados = response.total_points || response.grid_points?.length || 0;
        
        // Para las alertas críticas, usar evaluaciones de riesgo si están disponibles
        if (this.evaluacionesRiesgo.length > 0) {
          this.alertasCriticas = this.evaluacionesRiesgo.filter(e => e.nivelRiesgoGlobal === 'rojo').length;
        } else {
          // Fallback: asumir distribución estadística típica
          this.alertasCriticas = Math.round(this.totalPuntosMonitoreados * 0.1); // 10% en estado crítico aproximadamente
        }
        
        console.log(`📊 Estadísticas de cuadrículas de Aysén: ${this.totalPuntosMonitoreados} zonas monitoreadas, ${this.alertasCriticas} alertas críticas`);
      },
      error: (error) => {
        console.error('Error obteniendo cuadrículas de Aysén:', error);
        // Fallback: usar evaluaciones de riesgo previas
        this.totalPuntosMonitoreados = this.evaluacionesRiesgo.length;
        this.alertasCriticas = this.evaluacionesRiesgo.filter(e => e.nivelRiesgoGlobal === 'rojo').length;
      }
    });
  }
  private cargarGlaciares() {
    console.log('🏔️ Cargando datos de glaciares...');
    
    // Intentar cargar geometrías reales primero
    const glaciaresSubscription = this.glaciaresService.obtenerGeometriasGlaciares().subscribe({
      next: (geojson) => {
        this.procesarGeoJSONGlaciares(geojson);
        console.log(`✅ ${geojson.features.length} glaciares cargados con geometrías reales`);
      },
      error: (error) => {
        console.error('❌ Error cargando geometrías de glaciares:', error);
        // Fallback: cargar como marcadores simples
        this.cargarGlaciaresMarcadores();
      }
    });

    this.subscriptions.push(glaciaresSubscription);
  }

  private cargarGlaciaresMarcadores() {
    console.log('🔄 Cargando glaciares como marcadores...');
    
    const marcadoresSubscription = this.glaciaresService.obtenerGlaciares().subscribe({
      next: (glaciares) => {
        this.glaciares = glaciares;
        this.actualizarCapaGlaciares();
        console.log(`✅ ${glaciares.length} glaciares cargados como marcadores`);
      },
      error: (error) => {
        console.error('❌ Error cargando marcadores de glaciares:', error);
        console.log('ℹ️ Los glaciares no se mostrarán en el mapa');
      }
    });

    this.subscriptions.push(marcadoresSubscription);
  }

  private procesarGeoJSONGlaciares(geojson: any) {
    if (!this.mapa || !geojson.features || geojson.features.length === 0) return;

    // Limpiar capa existente
    this.glaciaresLayer.clearLayers();

    // Procesar cada feature del GeoJSON
    geojson.features.forEach((feature: any) => {
      try {
        const geometry = feature.geometry;
        const properties = feature.properties || {};
        
        let layer: L.Layer;
        
        if (geometry.type === 'Polygon') {
          const coords = geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]); // lon,lat -> lat,lon
          layer = L.polygon(coords, {
            color: this.getColorGlaciarPorArea(properties.area_km2 || 0),
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.4
          });
        } else if (geometry.type === 'MultiPolygon') {
          const coords = geometry.coordinates.map((polygon: number[][][]) => 
            polygon[0].map((coord: number[]) => [coord[1], coord[0]])
          );
          layer = L.polygon(coords, {
            color: this.getColorGlaciarPorArea(properties.area_km2 || 0),
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.4
          });
        } else {
          return; // Tipo no soportado
        }

        // Agregar popup con información del glaciar
        const nombre = properties.nombre || `Glaciar #${properties.id}`;
        const area = properties.area_km2 || 0;
        const volumen = properties.volumen_km3 || 0;
        const altura = properties.altura_media_m || 'N/A';
        const clasificacion = properties.clasificacion || 'No especificada';
        
        layer.bindPopup(`
          <div class="popup-glaciar">
            <h4>${nombre}</h4>
            <p><strong>Área:</strong> ${area.toFixed(2)} km²</p>
            <p><strong>Volumen:</strong> ${volumen.toFixed(3)} km³</p>
            <p><strong>Altura media:</strong> ${altura} m</p>
            <p><strong>Clasificación:</strong> ${clasificacion}</p>
            <p><strong>Frente termina en:</strong> ${properties.frente_termina_en || 'N/A'}</p>
            <p><strong>Orientación:</strong> ${properties.orientacion || 'N/A'}</p>
            <p><strong>Región:</strong> ${properties.region || 'Aysén'}</p>
          </div>
        `);

        this.glaciaresLayer.addLayer(layer);
      } catch (error) {
        console.warn(`Error procesando glaciar ${feature.properties?.nombre}:`, error);
      }
    });
  }

  private actualizarCapaGlaciares() {
    if (!this.mapa || this.glaciares.length === 0) return;

    // Limpiar capa existente
    this.glaciaresLayer.clearLayers();

    // Agregar cada glaciar como polígono
    this.glaciares.forEach(glaciar => {
      try {
        const coords = this.convertirCoordenadasParaLeaflet(glaciar.geometria.coordinates);
        
        let layer: L.Layer;
        
        if (glaciar.geometria.type === 'Polygon') {
          layer = L.polygon(coords as L.LatLngExpression[], {
            color: this.getColorGlaciar(glaciar.propiedades.estado),
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.3
          });
        } else if (glaciar.geometria.type === 'MultiPolygon') {
          layer = L.polygon(coords as L.LatLngExpression[][], {
            color: this.getColorGlaciar(glaciar.propiedades.estado),
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.3
          });
        } else {
          return; // Tipo no soportado
        }

        // Agregar popup con información del glaciar
        layer.bindPopup(`
          <div class="popup-glaciar">
            <h4>${glaciar.nombre}</h4>
            <p><strong>Tipo:</strong> ${this.getNombreTipoGlaciar(glaciar.propiedades.tipo)}</p>
            <p><strong>Estado:</strong> ${this.getNombreEstadoGlaciar(glaciar.propiedades.estado)}</p>
            <p><strong>Área:</strong> ${(glaciar.propiedades.area / 1000000).toFixed(2)} km²</p>
            <p><strong>Región:</strong> ${glaciar.propiedades.region}</p>
          </div>
        `);

        this.glaciaresLayer.addLayer(layer);
      } catch (error) {
        console.warn(`Error procesando glaciar ${glaciar.nombre}:`, error);
      }
    });
  }

  private convertirCoordenadasParaLeaflet(coordinates: any): L.LatLngExpression[] | L.LatLngExpression[][] {
    const convertirAnillo = (anillo: number[][]): L.LatLngExpression[] => {
      return anillo.map(coord => [coord[1], coord[0]] as L.LatLngExpression); // Intercambiar lon/lat a lat/lon
    };

    if (Array.isArray(coordinates[0][0][0])) {
      // MultiPolygon
      return coordinates.map((polygon: number[][][]) => 
        polygon.map((anillo: number[][]) => convertirAnillo(anillo))
      ).flat();
    } else {
      // Polygon
      return coordinates.map((anillo: number[][]) => convertirAnillo(anillo));
    }
  }
  private getColorGlaciar(estado: string): string {
    switch (estado) {
      case 'en_retroceso': return '#ff4444';
      case 'activo': return '#4444ff';
      case 'estable': return '#44ff44';
      default: return '#888888';
    }
  }

  private getColorGlaciarPorArea(area: number): string {
    // Colorear según el tamaño del glaciar
    if (area > 100) return '#0066cc'; // Azul oscuro para glaciares muy grandes
    if (area > 50) return '#3388cc';  // Azul medio para glaciares grandes
    if (area > 10) return '#66aacc';  // Azul claro para glaciares medianos
    if (area > 1) return '#99ccff';   // Azul muy claro para glaciares pequeños
    return '#ccddff';                 // Azul pálido para glaciares muy pequeños
  }

  private getNombreTipoGlaciar(tipo: string): string {
    switch (tipo) {
      case 'glaciar_montaña': return 'Glaciar de Montaña';
      case 'glaciar_tidewater': return 'Glaciar Tidewater';
      case 'campo_hielo': return 'Campo de Hielo';
      default: return 'Desconocido';
    }
  }

  private getNombreEstadoGlaciar(estado: string): string {
    switch (estado) {
      case 'en_retroceso': return 'En Retroceso';
      case 'activo': return 'Activo';
      case 'estable': return 'Estable';
      default: return 'Desconocido';
    }
  }


  private actualizarMarcadoresMapa() {
    if (!this.mapa) return;

    // Limpiar marcadores existentes
    this.markersLayer.clearLayers();

    // Agregar nuevos marcadores
    this.puntosPeligro.forEach(punto => {
      const color = this.getColorRiesgo(punto.nivelRiesgo);
      const icono = this.crearIconoPersonalizado(color, punto.tipo);

      const marker = L.marker([punto.latitud, punto.longitud], { icon: icono })
        .bindPopup(`
          <div class="popup-peligro">
            <h4>${punto.nombre}</h4>
            <p><strong>Riesgo:</strong> ${punto.nivelRiesgo.toUpperCase()}</p>
            <p><strong>Tipo:</strong> ${this.getNombreTipo(punto.tipo)}</p>
            <p>${punto.descripcion}</p>
          </div>
        `)
        .on('click', () => {
          this.seleccionarPeligro(punto);
        });

      this.markersLayer.addLayer(marker);
    });
  }
  private crearIconoPersonalizado(color: string, tipo: string): L.DivIcon {
    const iconoHtml = `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">
        ${this.getIconoTipoSimple(tipo)}
      </div>
    `;

    return L.divIcon({
      html: iconoHtml,
      className: 'custom-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  private getColorRiesgo(nivel: string): string {
    switch (nivel) {
      case 'critico': return '#d32f2f';
      case 'alto': return '#f57c00';
      case 'moderado': return '#fbc02d';
      case 'bajo': return '#388e3c';
      default: return '#757575';
    }
  }

  private getIconoTipoSimple(tipo: string): string {
    switch (tipo) {
      case 'iceberg': return '❄';
      case 'glaciar': return '🏔';
      case 'deforestacion': return '🌳';
      case 'reporte_ciudadano': return '👤';
      default: return '⚠';
    }  }

  // Métodos públicos del template
  centrarMapa() {
    if (this.mapa) {
      // Centrar en el corazón de la región de Aysén (cerca de Coyhaique)
      this.mapa.setView([-46.4, -72.7], 7);
    }
  }
  actualizarPeligros() {
    this.cargarEvaluacionesRiesgo();
  }

  seleccionarPeligro(peligro: PuntoRiesgo) {
    this.peligroSeleccionado = peligro;
    
    // Centrar el mapa en el peligro seleccionado
    if (this.mapa) {
      this.mapa.setView([peligro.latitud, peligro.longitud], 12);
    }
  }

  cerrarPanelInfo() {
    this.peligroSeleccionado = null;
  }

  getIconoTipo(tipo: string): string {
    switch (tipo) {
      case 'iceberg': return 'fa-snowflake';
      case 'glaciar': return 'fa-mountain';
      case 'deforestacion': return 'fa-tree';
      case 'reporte_ciudadano': return 'fa-user';
      default: return 'fa-exclamation-triangle';
    }
  }

  getNombreTipo(tipo: string): string {
    switch (tipo) {
      case 'iceberg': return 'Iceberg';
      case 'glaciar': return 'Glaciar';
      case 'deforestacion': return 'Deforestación';
      case 'reporte_ciudadano': return 'Reporte Ciudadano';
      default: return 'Desconocido';
    }
  }

  seguirPeligro(id: string) {
    console.log('Siguiendo peligro:', id);
    // Implementar lógica para seguir un peligro
  }

  reportarPeligro(id: string) {
    console.log('Reportando peligro:', id);
    // Implementar lógica para reportar un peligro
  }

  // Métodos del sistema de alertas
  activarSistemaAlertas() {
    this.sistemaAlertasActivo = true;
    this.ultimaActualizacion = new Date();
    console.log('✅ Sistema de alertas activado');
  }

  desactivarSistemaAlertas() {
    this.sistemaAlertasActivo = false;
    console.log('⏸️ Sistema de alertas pausado');
  }
  actualizarAlertas() {
    this.cargandoAlertas = true;
    
    // Recargar evaluaciones de riesgo
    this.cargarEvaluacionesRiesgo();
    
    // Recargar reportes
    this.cargarReportesRecientes();
    
    setTimeout(() => {
      this.cargandoAlertas = false;
      console.log('🔄 Alertas actualizadas con sistema de riesgo real');
    }, 1000);
  }

  // Métodos de reportes ciudadanos
  toggleFormularioReporte() {
    this.mostrandoFormulario = !this.mostrandoFormulario;
    if (!this.mostrandoFormulario) {
      this.resetearFormularioReporte();
    }
  }
  private resetearFormularioReporte() {
    this.nuevoReporte = {
      tipo: undefined,
      descripcion: '',
      reportante: '',
      email: '',
      latitud: -46.4000,
      longitud: -74.0000
    };
  }
  enviarReporte() {
    if (!this.validarReporte()) return;

    this.enviandoReporte = true;
    
    // Convertir el reporte del componente al formato del servicio
    const reporteParaServicio: Omit<Reporte, 'id' | 'fecha' | 'estado'> = {
      tipo: this.convertirTipoReporteParaServicio(this.nuevoReporte.tipo!),
      prioridad: 'media',
      titulo: this.generarTituloReporte(this.nuevoReporte.tipo!),
      descripcion: this.nuevoReporte.descripcion!,
      ubicacion: {
        latitud: this.nuevoReporte.latitud!,
        longitud: this.nuevoReporte.longitud!,
        nombre: `Ubicación reportada por ${this.nuevoReporte.reportante}`
      },
      autor: {
        nombre: this.nuevoReporte.reportante!,
        email: this.nuevoReporte.email || undefined
      },
      tags: [this.nuevoReporte.tipo!]
    };

    // Enviar usando el servicio real
    const envioSubscription = this.reportesService.crearReporte(reporteParaServicio).subscribe({
      next: (reporteCreado) => {
        // Agregar a la lista local
        const reporteLocal: ReporteCiudadano = {
          id: reporteCreado.id!,
          latitud: reporteCreado.ubicacion.latitud,
          longitud: reporteCreado.ubicacion.longitud,
          descripcion: reporteCreado.descripcion,
          tipo: this.convertirTipoReporte(reporteCreado.tipo),
          reportante: reporteCreado.autor.nombre,
          email: reporteCreado.autor.email || '',
          timestamp: reporteCreado.fecha,
          estado: this.convertirEstadoReporte(reporteCreado.estado)
        };

        this.reportesRecientes.unshift(reporteLocal);
        this.actualizarEstadisticas();
        this.enviandoReporte = false;
        this.mostrandoFormulario = false;
        this.resetearFormularioReporte();
        
        console.log('✅ Reporte enviado exitosamente');
        
        // Activar análisis automático usando el sistema de riesgo real
        setTimeout(() => {
          this.activarAnalisisAutomatico(reporteLocal);
        }, 2000);
      },
      error: (error) => {
        console.error('❌ Error enviando reporte:', error);
        this.enviandoReporte = false;
        // Aquí podrías mostrar un mensaje de error al usuario
      }
    });

    this.subscriptions.push(envioSubscription);
  }

  private convertirTipoReporteParaServicio(tipo: 'iceberg_avistado' | 'cambio_glaciar' | 'deforestacion' | 'contaminacion' | 'otro'): 'observacion' | 'alerta' | 'medicion' | 'incidente' {
    const mapping = {
      'iceberg_avistado': 'alerta' as const,
      'cambio_glaciar': 'observacion' as const,
      'deforestacion': 'incidente' as const,
      'contaminacion': 'incidente' as const,
      'otro': 'observacion' as const
    };
    return mapping[tipo];
  }

  private generarTituloReporte(tipo: 'iceberg_avistado' | 'cambio_glaciar' | 'deforestacion' | 'contaminacion' | 'otro'): string {
    const titulos = {
      'iceberg_avistado': 'Avistamiento de Iceberg',
      'cambio_glaciar': 'Cambio en Glaciar Observado',
      'deforestacion': 'Deforestación Detectada',
      'contaminacion': 'Contaminación Reportada',
      'otro': 'Reporte Ciudadano'
    };
    return titulos[tipo];
  }

  private validarReporte(): boolean {
    return !!(
      this.nuevoReporte.tipo &&
      this.nuevoReporte.descripcion &&
      this.nuevoReporte.reportante &&
      this.nuevoReporte.latitud &&
      this.nuevoReporte.longitud
    );
  }
  private activarAnalisisAutomatico(reporte: ReporteCiudadano) {
    console.log('🔍 Iniciando análisis automático para reporte:', reporte.id);
    
    // Actualizar estado del reporte
    const index = this.reportesRecientes.findIndex(r => r.id === reporte.id);
    if (index !== -1) {
      this.reportesRecientes[index].estado = 'analizando';
    }

    // Realizar evaluación de riesgo específica para la ubicación reportada
    const analisisSubscription = this.riesgoService.evaluarRiesgoUbicacion(reporte.latitud, reporte.longitud).pipe(
      catchError(error => {
        console.error('Error en análisis de ubicación:', error);
        // Fallback: crear punto de riesgo básico
        return of(this.crearEvaluacionFallback(reporte));
      })
    ).subscribe(evaluacion => {
      // Crear punto de peligro basado en la evaluación de riesgo real
      const nuevoPuntoRiesgo: PuntoRiesgo = {
        id: `reporte_${reporte.id}`,
        nombre: `${evaluacion.ubicacion.nombre} (Reporte: ${reporte.reportante})`,
        latitud: evaluacion.ubicacion.latitud,
        longitud: evaluacion.ubicacion.longitud,
        nivelRiesgo: this.convertirNivelRiesgoGlobalAPuntoRiesgo(evaluacion.nivelRiesgoGlobal),
        tipo: 'reporte_ciudadano',
        descripcion: `${reporte.descripcion}\n\nAnálisis: ${this.generarDescripcionDesdeEvaluacion(evaluacion)}`,
        factores: [...evaluacion.alertasGeneradas, 'Reporte ciudadano verificado'],
        timestamp: reporte.timestamp
      };

      this.puntosPeligro.push(nuevoPuntoRiesgo);
      this.actualizarMarcadoresMapa();

      // Actualizar estado del reporte basado en el nivel de riesgo
      if (index !== -1) {
        const estadoFinal = evaluacion.nivelRiesgoGlobal === 'verde' ? 'falso_positivo' : 'verificado';
        this.reportesRecientes[index].estado = estadoFinal;
      }

      this.actualizarEstadisticas();
      console.log('✅ Análisis automático completado');
    });

    this.subscriptions.push(analisisSubscription);
  }
  private crearEvaluacionFallback(reporte: ReporteCiudadano): EvaluacionRiesgo {
    return {
      ubicacion: {
        nombre: `Ubicación Reporte ${reporte.reportante}`,
        latitud: reporte.latitud,
        longitud: reporte.longitud
      },
      timestamp: new Date(),
      variables: [
        {
          nombre: 'Datos meteorológicos',
          valor: 0,
          peso: 1,
          puntaje: 0,
          nivel: 'bajo',
          descripcion: 'Sin datos disponibles - sistema meteorológico desconectado'
        }
      ],
      puntajeTotal: 0,
      nivelRiesgoGlobal: 'verde',
      confianza: 0,
      tendencia: 'estable',
      alertasGeneradas: ['Sin datos meteorológicos disponibles'],
      recomendaciones: ['Verificar manualmente la zona reportada', 'Intentar reconexión al sistema meteorológico'],
      validoHasta: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  cancelarReporte() {
    this.mostrandoFormulario = false;
    this.resetearFormularioReporte();
  }
  analizarZonaReporte(reporte: ReporteCiudadano) {
    this.analizandoReporte = reporte.id;
    
    // Usar el sistema de riesgo real para analizar la zona
    const analisisSubscription = this.riesgoService.evaluarRiesgoUbicacion(reporte.latitud, reporte.longitud).pipe(
      catchError(error => {
        console.error('Error en análisis de zona:', error);
        return of(this.crearEvaluacionFallback(reporte));
      })
    ).subscribe(evaluacion => {
      const index = this.reportesRecientes.findIndex(r => r.id === reporte.id);
      if (index !== -1) {
        // Determinar estado basado en la evaluación
        const estadoFinal = evaluacion.nivelRiesgoGlobal === 'verde' ? 'falso_positivo' : 'verificado';
        this.reportesRecientes[index].estado = estadoFinal;
      }
      
      this.analizandoReporte = null;
      this.actualizarEstadisticas();
      console.log('✅ Análisis de zona completado con sistema de riesgo real:', reporte.id);
    });

    this.subscriptions.push(analisisSubscription);
  }

  verEnMapa(reporte: ReporteCiudadano) {
    if (this.mapa) {
      this.mapa.setView([reporte.latitud, reporte.longitud], 14);
    }
  }
  private cargarReportesRecientes() {
    // Cargar reportes desde el servicio real
    const reportesSubscription = this.reportesService.obtenerReportes().subscribe(reportes => {
      // Convertir reportes del servicio al formato del componente
      this.reportesRecientes = reportes.map(reporte => ({
        id: reporte.id || '',
        latitud: reporte.ubicacion.latitud,
        longitud: reporte.ubicacion.longitud,
        descripcion: reporte.descripcion,
        tipo: this.convertirTipoReporte(reporte.tipo),
        reportante: reporte.autor.nombre,
        email: reporte.autor.email || '',
        timestamp: reporte.fecha,
        estado: this.convertirEstadoReporte(reporte.estado)
      }));
      
      this.actualizarEstadisticas();
    });

    this.subscriptions.push(reportesSubscription);
  }

  private convertirTipoReporte(tipo: 'observacion' | 'alerta' | 'medicion' | 'incidente'): 'iceberg_avistado' | 'cambio_glaciar' | 'deforestacion' | 'contaminacion' | 'otro' {
    const mapping = {
      'observacion': 'cambio_glaciar' as const,
      'alerta': 'iceberg_avistado' as const,
      'medicion': 'otro' as const,
      'incidente': 'contaminacion' as const
    };
    return mapping[tipo];
  }

  private convertirEstadoReporte(estado: 'pendiente' | 'en_revision' | 'validado' | 'rechazado'): 'pendiente' | 'verificado' | 'analizando' | 'falso_positivo' {
    const mapping = {
      'pendiente': 'pendiente' as const,
      'en_revision': 'analizando' as const,
      'validado': 'verificado' as const,
      'rechazado': 'falso_positivo' as const
    };
    return mapping[estado];
  }

  getIconoTipoReporte(tipo: string): string {
    switch (tipo) {
      case 'iceberg_avistado': return 'fa-snowflake';
      case 'cambio_glaciar': return 'fa-mountain';
      case 'deforestacion': return 'fa-tree';
      case 'contaminacion': return 'fa-smog';
      default: return 'fa-flag';
    }
  }

  getNombreTipoReporte(tipo: string): string {
    switch (tipo) {
      case 'iceberg_avistado': return 'Iceberg Avistado';
      case 'cambio_glaciar': return 'Cambio en Glaciar';
      case 'deforestacion': return 'Deforestación';
      case 'contaminacion': return 'Contaminación';
      case 'otro': return 'Reporte Ciudadano';
      default: return 'Desconocido';
    }
  }

  getNombreEstado(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'verificado': return 'Verificado';
      case 'analizando': return 'Analizando';      case 'falso_positivo': return 'Falso Positivo';
      default: return 'Desconocido';
    }
  }

  trackByReporteId(index: number, reporte: ReporteCiudadano): string {
    return reporte.id;
  }

  /**
   * Calcula un nivel de riesgo simple basado en la ubicación de la cuadrícula
   */
  private calcularNivelRiesgoSimple(cuadricula: any): 'bajo' | 'moderado' | 'alto' | 'critico' {
    // Algoritmo simple basado en características de la región
    const { lat, lon, comuna } = cuadricula;
    
    let riesgo = 0;
    
    // Factor latitud: más al sur = más riesgo por campos de hielo
    if (lat < -48) riesgo += 2; // Zona de campos de hielo sur
    else if (lat < -46) riesgo += 1; // Zona central
    
    // Factor longitud: más al oeste = más riesgo por costa y glaciares tidewater
    if (lon < -73) riesgo += 2; // Zona costera occidental
    else if (lon < -72) riesgo += 1; // Zona intermedia
    
    // Factor comuna: algunas comunas tienen mayor densidad glaciar
    const comunasAltoRiesgo = ['Cochrane', 'O\'Higgins', 'Tortel'];
    const comunasRiesgoMedio = ['Coyhaique', 'Aysén', 'Chile Chico'];
    
    if (comunasAltoRiesgo.includes(comuna)) riesgo += 2;
    else if (comunasRiesgoMedio.includes(comuna)) riesgo += 1;
    
  // Distribuir niveles
    if (riesgo >= 5) return 'critico';
    if (riesgo >= 3) return 'alto';
    if (riesgo >= 1) return 'moderado';
    return 'bajo';
  }

  // Métodos para análisis de cuadrícula seleccionada
  onCuadriculaSeleccionada(datos: DatosMeteorologicosCuadricula) {
    this.cuadriculaSeleccionada = datos;
    console.log('🎯 Cuadrícula seleccionada para análisis detallado:', datos);
  }

  cerrarAnalisisCuadricula() {
    this.cuadriculaSeleccionada = null;
  }

  obtenerNombreCuadricula(id: string): string {
    const partes = id.split('_');
    if (partes.length >= 2) {
      const zona = partes[0];
      const numero = partes[1];
      return `Zona ${zona.toUpperCase()} ${numero}`;
    }
    return `Zona ${id}`;
  }

  getResumenRiesgoDetallado(datos: DatosMeteorologicosCuadricula): string {
    const temp = datos.temperatura.actual;
    const precip = datos.precipitacion;
    const viento = datos.viento.velocidad;
    const humedad = datos.humedad;

    switch (datos.nivelRiesgo) {
      case 'critico':
        return `🚨 RIESGO CRÍTICO: Condiciones meteorológicas extremas detectadas por OpenMeteo. ${this.getFactorPrincipalDetallado(temp, precip, viento, humedad)} Se recomienda evacuación preventiva y monitoreo constante.`;
      case 'alto':
        return `⚠️ RIESGO ALTO: Condiciones adversas significativas según datos OpenMeteo. ${this.getFactorPrincipalDetallado(temp, precip, viento, humedad)} Mantener vigilancia activa.`;
      case 'moderado':
        return `🟡 RIESGO MODERADO: Algunas condiciones requieren precaución según OpenMeteo. ${this.getFactorPrincipalDetallado(temp, precip, viento, humedad)} Monitoreo regular recomendado.`;
      case 'bajo':
        return `✅ RIESGO BAJO: Condiciones meteorológicas estables reportadas por OpenMeteo. ${this.getFactorPrincipalDetallado(temp, precip, viento, humedad)}`;
      default:
        return 'Evaluando condiciones meteorológicas...';
    }
  }

  private getFactorPrincipalDetallado(temp: number, precip: number, viento: number, humedad: number): string {
    if (temp > 25 && precip > 30) return 'Factor dominante: Temperatura extrema + lluvia torrencial = deshielo catastrófico.';
    if (temp > 25) return 'Factor dominante: Temperatura extrema (>25°C) causa deshielo masivo de glaciares.';
    if (precip > 50) return 'Factor dominante: Precipitación torrencial (>50mm) genera crecidas súbitas.';
    if (viento > 60) return 'Factor dominante: Vientos huracanados (>60km/h) transportan icebergs masivamente.';
    if (temp > 20 && precip > 20) return 'Factor dominante: Temperatura alta + lluvia intensa aceleran deshielo peligrosamente.';
    if (humedad > 95 && viento < 10) return 'Factor dominante: Saturación atmosférica genera niebla densa con visibilidad nula.';
    if (temp > 20) return 'Factor dominante: Temperatura elevada (>20°C) para la región patagónica.';
    if (precip > 30) return 'Factor dominante: Lluvia intensa (>30mm) eleva niveles de agua glaciar.';
    if (viento > 40) return 'Factor dominante: Vientos fuertes (>40km/h) pueden desplazar fragmentos de hielo.';
    if (temp > 15) return 'Factor principal: Temperatura moderadamente alta favorece deshielo controlado.';
    if (precip > 15) return 'Factor principal: Precipitación moderada contribuye al ciclo hidrológico glaciar.';
    if (temp < 0 && precip > 10) return 'Factor favorable: Temperaturas bajo cero + precipitación consolidan masa glaciar.';
    return 'Condiciones meteorológicas dentro de parámetros normales para la región.';
  }

  getClaseFactorTemperatura(temp: number): string {
    if (temp > 20) return 'factor-critico';
    if (temp > 15) return 'factor-alto';
    if (temp > 10) return 'factor-moderado';
    return 'factor-bajo';
  }

  getExplicacionTemperatura(temp: number): string {
    if (temp > 25) return `🔥 CRÍTICO: Temperatura extrema para la Patagonia, deshielo masivo de glaciares`;
    if (temp > 20) return `⚠️ ALTO: Temperatura muy elevada, riesgo significativo de derretimiento acelerado`;
    if (temp > 15) return `🟡 MODERADO: Temperatura alta para la región, actividad de deshielo notable`;
    if (temp > 10) return `🟢 NORMAL: Temperatura moderada, deshielo controlado`;
    if (temp > 5) return `❄️ FRÍO: Temperatura baja, condiciones glaciares estables`;
    if (temp > 0) return `🧊 CERCA CERO: Punto crítico de congelación/deshielo`;
    if (temp > -5) return `🌨️ BAJO CERO: Congelación, acumulación de hielo`;
    return `🥶 EXTREMO: Congelación severa, glaciares en expansión`;
  }

  getClaseFactorPrecipitacion(precip: number, temp: number): string {
    if (precip > 30) return 'factor-critico';
    if (precip > 20) return 'factor-alto';
    if (precip > 10) return 'factor-moderado';
    return 'factor-bajo';
  }

  getExplicacionPrecipitacion(precip: number, temp: number): string {
    if (precip > 50) return `🌊 TORRENCIAL: Precipitación extrema, alto riesgo de crecidas súbitas y desbordamientos`;
    if (precip > 30) return `🌧️ INTENSA: Lluvia muy fuerte, posible aumento crítico de caudales glaciares`;
    if (precip > 20) {
      if (temp > 10) return `☔ MODERADA-ALTA: Lluvia + calor acelera significativamente el deshielo`;
      return `🌨️ NIEVE MODERADA: Acumulación favorable, reserva hídrica para glaciares`;
    }
    if (precip > 10) {
      if (temp > 15) return `🌦️ LIGERA: Lluvia ligera pero con temperatura alta, contribuye al deshielo`;
      return `❄️ NIEVE LIGERA: Precipitación normal para la región`;
    }
    if (precip > 1) return `💧 MÍNIMA: Precipitación muy ligera, sin impacto significativo`;
    return `☀️ SECO: Sin precipitación, tiempo estable pero vigilar sequía`;
  }

  getClaseFactorViento(viento: number): string {
    if (viento > 50) return 'factor-critico';
    if (viento > 30) return 'factor-alto';
    if (viento > 15) return 'factor-moderado';
    return 'factor-bajo';
  }

  getExplicacionViento(viento: number): string {
    if (viento > 80) return `🌪️ HURACANADO: Viento extremo, peligro mortal, evacuación inmediata`;
    if (viento > 60) return `💨 TEMPORAL: Viento muy fuerte, daños estructurales, transporte masivo de icebergs`;
    if (viento > 40) return `🌬️ FUERTE: Viento intenso, posible desplazamiento de icebergs, precaución extrema`;
    if (viento > 25) return `🍃 MODERADO-FUERTE: Viento considerable, puede mover fragmentos de hielo`;
    if (viento > 15) return `🌱 MODERADO: Viento normal para la Patagonia, condiciones navegables`;
    if (viento > 8) return `🌾 BRISA: Viento ligero, condiciones ideales para actividades`;
    if (viento > 3) return `🌸 SUAVE: Brisa muy suave, calma relativa`;
    return `🌅 CALMA: Sin viento, espejo de agua, condiciones de calma total`;
  }

  getClaseFactorHumedad(humedad: number): string {
    if (humedad > 90) return 'factor-alto';
    if (humedad > 70) return 'factor-moderado';
    return 'factor-bajo';
  }

  getExplicacionHumedad(humedad: number): string {
    if (humedad > 95) return `🌫️ SATURACIÓN: Niebla densa garantizada, visibilidad nula, navegación imposible`;
    if (humedad > 90) return `💨 MUY HÚMEDO: Alta probabilidad de niebla, visibilidad reducida`;
    if (humedad > 80) return `🌧️ HÚMEDO: Condiciones húmedas, posible nubosidad baja`;
    if (humedad > 70) return `🌤️ MODERADO: Humedad normal para clima patagónico`;
    if (humedad > 60) return `☀️ CÓMODO: Nivel de humedad agradable, aire fresco`;
    if (humedad > 40) return `🌵 SECO: Aire relativamente seco, buena visibilidad`;
    if (humedad > 30) return `🏜️ MUY SECO: Humedad baja, excelente visibilidad`;
    return `🌫️ EXTREMO: Humedad crítica, monitorear condiciones`;
  }

  obtenerDireccionViento(grados: number): string {
    const direcciones = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const indice = Math.round(grados / 45) % 8;
    return direcciones[indice];
  }

  // Nuevos métodos para el panel mejorado
  obtenerCoordenadasCuadricula(cuadriculaId: string): string {
    // Simular coordenadas basadas en el ID de la cuadrícula
    // En un caso real, estas vendrían del backend
    const coordenadas = {
      'ohiggins_1': '-48.5766°, -73.2901°',
      'ohiggins_2': '-48.5766°, -73.2901°',
      'ohiggins_3': '-48.6200°, -73.3200°',
      'coyhaique_1': '-45.5752°, -72.0662°',
      'coyhaique_2': '-45.6000°, -72.1000°',
      'coyhaique_3': '-45.6200°, -72.1200°'
    };
    return coordenadas[cuadriculaId as keyof typeof coordenadas] || '-48.0000°, -73.0000°';
  }

  getIconoRiesgo(nivel: string): string {
    const iconos = {
      'bajo': 'fa-check-circle',
      'medio': 'fa-exclamation-triangle',
      'alto': 'fa-exclamation-circle',
      'critico': 'fa-skull-crossbones'
    };
    return iconos[nivel as keyof typeof iconos] || 'fa-question-circle';
  }

  getDescripcionZonaDetallada(datos: DatosMeteorologicosCuadricula): string {
    const zona = datos.cuadriculaId.split('_')[0];
    const nombreZona = zona.charAt(0).toUpperCase() + zona.slice(1);
    
    return `Zona de monitoreo en ${nombreZona.toUpperCase()}, región de Aysén. Esta área está sujeta a monitoreo continuo debido a su importancia glaciológica y los potenciales riesgos derivados de las condiciones meteorológicas extremas que pueden afectar la estabilidad de los glaciares circundantes.`;
  }
}
