import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface GlaciarFeature {
  id: string;
  nombre: string;
  geometria: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  propiedades: {
    area: number;
    perimetro: number;
    estado: 'activo' | 'en_retroceso' | 'estable';
    tipo: 'glaciar_montaña' | 'glaciar_tidewater' | 'campo_hielo';
    altitud_min: number;
    altitud_max: number;
    region: string;
  };
  centroide: {
    latitud: number;
    longitud: number;
  };
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: any;
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

@Injectable({
  providedIn: 'root'
})
export class GlaciaresService {
  private readonly BACKEND_URL = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}
  /**
   * Obtiene los datos de glaciares desde el backend
   */
  obtenerGlaciares(): Observable<GlaciarFeature[]> {
    return this.http.get<any>(`${this.BACKEND_URL}/icebergs/marcadores`).pipe(
      map(response => this.convertirMarcadoresAGlaciares(response.marcadores || [])),
      catchError(error => {
        console.error('Error cargando glaciares desde API:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene glaciares en un área específica
   */
  obtenerGlaciaresPorArea(
    latMin: number, 
    lonMin: number, 
    latMax: number, 
    lonMax: number
  ): Observable<GlaciarFeature[]> {
    const params = {
      lat_min: latMin.toString(),
      lon_min: lonMin.toString(),
      lat_max: latMax.toString(),
      lon_max: lonMax.toString()
    };

    return this.http.get<GeoJSONFeatureCollection>(`${this.BACKEND_URL}/glaciares/area`, { params }).pipe(
      map(geojson => this.convertirGeoJSONAGlaciares(geojson)),
      catchError(error => {
        console.error('Error cargando glaciares por área:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene información de un glaciar específico
   */
  obtenerGlaciarPorId(id: string): Observable<GlaciarFeature | null> {
    return this.http.get<GeoJSONFeature>(`${this.BACKEND_URL}/glaciares/${id}`).pipe(
      map(feature => this.convertirFeatureAGlaciar(feature)),
      catchError(error => {
        console.error('Error cargando glaciar específico:', error);
        return of(null);
      })
    );
  }
  /**
   * Convierte datos GeoJSON a nuestro formato de glaciar
   */
  private convertirGeoJSONAGlaciares(geojson: GeoJSONFeatureCollection): GlaciarFeature[] {
    if (!geojson || !geojson.features) {
      return [];
    }

    return geojson.features.map(feature => this.convertirFeatureAGlaciar(feature));
  }

  /**
   * Convierte marcadores del backend a nuestro formato de glaciar
   */
  private convertirMarcadoresAGlaciares(marcadores: any[]): GlaciarFeature[] {
    if (!marcadores || marcadores.length === 0) {
      return [];
    }

    return marcadores.map(marcador => {
      return {
        id: marcador.id.toString(),
        nombre: marcador.nombre,
        geometria: {
          type: 'Polygon',
          coordinates: [[
            [marcador.lng, marcador.lat],
            [marcador.lng + 0.01, marcador.lat],
            [marcador.lng + 0.01, marcador.lat + 0.01],
            [marcador.lng, marcador.lat + 0.01],
            [marcador.lng, marcador.lat]
          ]] // Crear un polígono simple alrededor del punto
        },
        propiedades: {
          area: marcador.area_km2 || 0,
          perimetro: 0, // No disponible en marcadores
          estado: this.determinarEstadoPorArea(marcador.area_km2),
          tipo: this.determinarTipoPorClasificacion(marcador.clasificacion),
          altitud_min: marcador.altura_minima_m || 0,
          altitud_max: marcador.altura_maxima_m || 0,
          region: marcador.region || 'Región de Aysén'
        },
        centroide: {
          latitud: marcador.lat,
          longitud: marcador.lng
        }
      };
    });
  }

  /**
   * Convierte una feature GeoJSON a nuestro formato de glaciar
   */
  private convertirFeatureAGlaciar(feature: GeoJSONFeature): GlaciarFeature {
    const props = feature.properties || {};
    
    // Calcular centroide de la geometría
    const centroide = this.calcularCentroide(feature.geometry);

    return {
      id: props.id || props.ID || props.FID || Math.random().toString(36),
      nombre: props.nombre || props.NOMBRE || props.NAME || 'Glaciar sin nombre',
      geometria: {
        type: feature.geometry.type as 'Polygon' | 'MultiPolygon',
        coordinates: feature.geometry.coordinates
      },
      propiedades: {
        area: props.area || props.AREA || props.Shape_Area || 0,
        perimetro: props.perimetro || props.PERIMETER || props.Shape_Leng || 0,
        estado: this.determinarEstadoGlaciar(props),
        tipo: this.determinarTipoGlaciar(props),
        altitud_min: props.altitud_min || props.ALT_MIN || 0,
        altitud_max: props.altitud_max || props.ALT_MAX || 0,
        region: props.region || props.REGION || 'Región de Aysén'
      },
      centroide
    };
  }

  /**
   * Calcula el centroide aproximado de una geometría
   */
  private calcularCentroide(geometry: any): { latitud: number; longitud: number } {
    let latSum = 0;
    let lonSum = 0;
    let count = 0;

    const procesarCoordenadas = (coords: any) => {
      if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number') {
        // Es un punto [lon, lat]
        lonSum += coords[0];
        latSum += coords[1];
        count++;
      } else if (Array.isArray(coords)) {
        // Es un array de coordenadas, procesar recursivamente
        coords.forEach(procesarCoordenadas);
      }
    };

    procesarCoordenadas(geometry.coordinates);

    return {
      latitud: count > 0 ? latSum / count : -46.0,
      longitud: count > 0 ? lonSum / count : -73.0
    };
  }

  /**
   * Determina el estado del glaciar basado en las propiedades
   */
  private determinarEstadoGlaciar(props: any): 'activo' | 'en_retroceso' | 'estable' {
    const estado = props.estado || props.ESTADO || props.STATUS;
    
    if (estado) {
      const estadoLower = estado.toString().toLowerCase();
      if (estadoLower.includes('retroceso') || estadoLower.includes('retreat')) {
        return 'en_retroceso';
      }
      if (estadoLower.includes('activo') || estadoLower.includes('active')) {
        return 'activo';
      }
    }
    
    return 'estable'; // Por defecto
  }
  /**
   * Determina el tipo de glaciar basado en las propiedades
   */
  private determinarTipoGlaciar(props: any): 'glaciar_montaña' | 'glaciar_tidewater' | 'campo_hielo' {
    const tipo = props.tipo || props.TIPO || props.TYPE;
    const nombre = props.nombre || props.NOMBRE || props.NAME || '';
    
    if (tipo) {
      const tipoLower = tipo.toString().toLowerCase();
      if (tipoLower.includes('tidewater') || tipoLower.includes('marea')) {
        return 'glaciar_tidewater';
      }
      if (tipoLower.includes('campo') || tipoLower.includes('icefield')) {
        return 'campo_hielo';
      }
    }
    
    // Inferir por nombre
    if (nombre.toLowerCase().includes('campo')) {
      return 'campo_hielo';
    }
    
    return 'glaciar_montaña'; // Por defecto
  }

  /**
   * Determina el estado del glaciar basado en el área (heurística)
   */
  private determinarEstadoPorArea(area: number): 'activo' | 'en_retroceso' | 'estable' {
    if (area > 50) return 'activo'; // Glaciares grandes tienden a ser más activos
    if (area < 5) return 'en_retroceso'; // Glaciares pequeños pueden estar en retroceso
    return 'estable';
  }

  /**
   * Determina el tipo de glaciar basado en la clasificación del backend
   */
  private determinarTipoPorClasificacion(clasificacion: string): 'glaciar_montaña' | 'glaciar_tidewater' | 'campo_hielo' {
    if (!clasificacion) return 'glaciar_montaña';
    
    const clasif = clasificacion.toLowerCase();
    if (clasif.includes('campo') || clasif.includes('icefield') || clasif.includes('hielo')) {
      return 'campo_hielo';
    }
    if (clasif.includes('tidewater') || clasif.includes('marea') || clasif.includes('calving')) {
      return 'glaciar_tidewater';
    }
    return 'glaciar_montaña';
  }

  /**
   * Obtiene geometrías reales de glaciares desde el backend
   */
  obtenerGeometriasGlaciares(): Observable<GeoJSONFeatureCollection> {
    return this.http.get<any>(`${this.BACKEND_URL}/icebergs/geojson-optimizado`).pipe(
      catchError(error => {
        console.error('Error cargando geometrías de glaciares:', error);
        // Fallback: crear geometrías simples desde marcadores
        return this.crearGeometriasDeseMarcadores();
      })
    );
  }
  /**
   * Crea geometrías simples desde los marcadores cuando no hay GeoJSON disponible
   */
  private crearGeometriasDeseMarcadores(): Observable<GeoJSONFeatureCollection> {
    return this.http.get<any>(`${this.BACKEND_URL}/icebergs/marcadores`).pipe(
      map(response => {
        const features: GeoJSONFeature[] = response.marcadores.map((marcador: any) => {
          // Crear un polígono circular aproximado alrededor del punto
          const radius = Math.sqrt(marcador.area_km2 || 1) * 0.01; // Radio proporcional al área
          const centerLat = marcador.lat;
          const centerLng = marcador.lng;
          
          // Crear polígono circular con 12 lados
          const coordinates = [];
          for (let i = 0; i <= 12; i++) {
            const angle = (i * 2 * Math.PI) / 12;
            const lat = centerLat + radius * Math.cos(angle);
            const lng = centerLng + radius * Math.sin(angle);
            coordinates.push([lng, lat]);
          }
          
          return {
            type: 'Feature' as const,
            properties: {
              id: marcador.id,
              nombre: marcador.nombre,
              area_km2: marcador.area_km2,
              volumen_km3: marcador.volumen_km3,
              clasificacion: marcador.clasificacion,
              frente_termina_en: marcador.frente_termina_en,
              altura_media_m: marcador.altura_media_m,
              altura_maxima_m: marcador.altura_maxima_m,
              altura_minima_m: marcador.altura_minima_m,
              orientacion: marcador.orientacion,
              pendiente_grados: marcador.pendiente_grados,
              region: marcador.region,
              comuna: marcador.comuna
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          };
        });

        return {
          type: 'FeatureCollection' as const,
          features: features
        };
      }),
      catchError(error => {
        console.error('Error creando geometrías desde marcadores:', error);
        return of({ 
          type: 'FeatureCollection' as const, 
          features: [] as GeoJSONFeature[] 
        });
      })
    );
  }

  /**
   * Obtiene las ubicaciones de glaciares para el sistema de pronóstico
   */
  obtenerUbicacionesParaPronostico(): Observable<Array<{nombre: string, latitud: number, longitud: number}>> {
    return this.obtenerGlaciares().pipe(
      map(glaciares => glaciares.map(glaciar => ({
        nombre: glaciar.nombre,
        latitud: glaciar.centroide.latitud,
        longitud: glaciar.centroide.longitud
      })))
    );
  }
}
