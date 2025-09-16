import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { Iceberg, GlaciarData } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class GlaciarService {
  private readonly API_BASE = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene datos de glaciares de la región de Aysén
   */
  obtenerGlaciaresAysen(): Observable<GlaciarData[]> {
    return this.http.get<any>(`${this.API_BASE}/glaciares/aysen`).pipe(
      map(response => this.procesarDatosGlaciares(response)),
      catchError(error => {
        console.error('Error obteniendo glaciares de Aysén:', error);
        return of(this.getDatosMockGlaciares());
      })
    );
  }

  /**
   * Obtiene datos de glaciares más recientes (2022)
   */
  obtenerGlaciares2022(): Observable<GlaciarData[]> {
    return this.http.get<any>(`${this.API_BASE}/glaciares/2022`).pipe(
      map(response => this.procesarDatosGlaciares(response)),
      catchError(error => {
        console.error('Error obteniendo glaciares 2022:', error);
        return of(this.getDatosMockGlaciares());
      })
    );
  }  /**
   * Obtiene lista de icebergs detectados (datos optimizados de glaciares)
   */
  obtenerIcebergs(): Observable<Iceberg[]> {
    return this.http.get<any>(`${this.API_BASE}/icebergs`).pipe(
      map(response => this.procesarDatosIcebergs(response)),
      catchError(error => {
        console.error('Error obteniendo icebergs:', error);
        return of(this.getMockIcebergs());
      })
    );
  }

  /**
   * Obtiene información de comunas de Aysén (para context geográfico)
   */
  obtenerComunasAysen(): Observable<any> {
    return this.http.get(`${this.API_BASE}/geojson/comunas_aysen`).pipe(
      catchError(error => {
        console.error('Error obteniendo comunas de Aysén:', error);
        return of(null);
      })
    );
  }

  /**
   * Procesa los datos de glaciares desde la API
   */
  private procesarDatosGlaciares(response: any): GlaciarData[] {
    if (!response || !response.features) {
      return [];
    }

    return response.features.map((feature: any, index: number) => ({
      id: feature.id || `glaciar_${index}`,
      nombre: feature.properties?.NOMBRE || feature.properties?.name || `Glaciar ${index + 1}`,
      area: feature.properties?.AREA || feature.properties?.area || Math.random() * 1000,
      volumen: feature.properties?.VOLUMEN || (feature.properties?.AREA || Math.random() * 1000) * 50,
      geometria: feature.geometry,
      propiedades: feature.properties
    }));
  }

  /**
   * Genera icebergs simulados basados en datos de glaciares
   */
  private generarIcebergsDesdeGlaciares(glaciares: GlaciarData[]): Iceberg[] {
    const icebergs: Iceberg[] = [];
    const nivelesRiesgo: ('bajo' | 'medio' | 'alto')[] = ['bajo', 'medio', 'alto'];
    
    // Generar 5-8 icebergs simulados
    const numIcebergs = Math.floor(Math.random() * 4) + 5;
    
    for (let i = 0; i < numIcebergs; i++) {      icebergs.push({
        id: `iceberg_${i + 1}`,
        nombre: `Iceberg ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
        tamano: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 m²
        coordenadas: {
          latitud: -45.5 + (Math.random() - 0.5) * 2, // Rango alrededor de Aysén
          longitud: -72.0 + (Math.random() - 0.5) * 3
        },
        nivelRiesgo: nivelesRiesgo[Math.floor(Math.random() * nivelesRiesgo.length)],
        impactoEcologico: this.generarImpactoEcologico(),
        volumenEstimado: Math.floor(Math.random() * 50000) + 10000 // 10000-60000 m³
      });
    }

    return icebergs;
  }

  /**
   * Genera descripción de impacto ecológico
   */
  private generarImpactoEcologico(): string {
    const impactos = [
      'Alteración de corrientes marinas locales',
      'Cambio en la salinidad del agua',
      'Impacto en la fauna marina',
      'Modificación del ecosistema costero',
      'Efecto en la temperatura del agua',
      'Influencia en patrones de navegación'
    ];
    
    return impactos[Math.floor(Math.random() * impactos.length)];
  }

  /**
   * Procesa los datos de icebergs desde la API optimizada
   */
  private procesarDatosIcebergs(response: any): Iceberg[] {
    if (!response || !response.features) {
      return [];
    }

    return response.features.map((feature: any, index: number) => {
      const props = feature.properties || {};
      const coordenadas = {
        latitud: props.latitud || 0,
        longitud: props.longitud || 0
      };
      
      return {
        id: props.id || `iceberg_${index}`,
        nombre: props.nombre || `Glaciar ${index + 1}`,
        tamano: Math.round((props.area_km2 || 0) * 1000000), // Convertir km² a m²
        coordenadas: coordenadas,
        nivelRiesgo: this.calcularNivelRiesgo(props.area_km2 || 0),
        impactoEcologico: this.generarImpactoEcologico(),
        volumenEstimado: Math.round((props.volumen_km3 || 0) * 1000000000), // Convertir km³ a m³
        // Datos adicionales para el sidebar
        datosCompletos: {
          area_km2: props.area_km2,
          volumen_km3: props.volumen_km3,
          clasificacion: props.clasificacion,
          frente_termina_en: props.frente_termina_en,
          altura_media_m: props.altura_media_m,
          altura_maxima_m: props.altura_maxima_m,
          altura_minima_m: props.altura_minima_m,
          orientacion: props.orientacion,
          pendiente_grados: props.pendiente_grados,
          latitud: props.latitud,
          longitud: props.longitud,
          region: props.region,
          comuna: props.comuna
        }
      };
    });
  }

  /**
   * Calcula el nivel de riesgo basado en el área del glaciar
   */
  private calcularNivelRiesgo(area_km2: number): 'bajo' | 'medio' | 'alto' {
    if (area_km2 > 10) return 'alto';
    if (area_km2 > 1) return 'medio';
    return 'bajo';
  }

  /**
   * Datos mock para icebergs
   */
  private getMockIcebergs(): Iceberg[] {
    return [
      {
        id: 'mock_iceberg_1',
        nombre: 'Glaciar San Rafael',
        tamano: 4500000, // 4.5 km² en m²
        coordenadas: { latitud: -46.7, longitud: -73.8 },
        nivelRiesgo: 'alto',
        impactoEcologico: 'Alteración de corrientes marinas locales',
        volumenEstimado: 225000000, // 0.225 km³ en m³
        datosCompletos: {
          area_km2: 4.5,
          volumen_km3: 0.225,
          clasificacion: 'Glaciar Marino',
          frente_termina_en: 'Mar',
          altura_media_m: 1200,
          altura_maxima_m: 1800,
          altura_minima_m: 0,
          orientacion: 'SW',
          pendiente_grados: 15.5,
          latitud: -46.7,
          longitud: -73.8,
          region: 'Aysén del Gral. Carlos Ibáñez del Campo',
          comuna: 'Río Ibáñez'
        }
      }
    ];
  }

  /**
   * Datos mock para fallback
   */
  private getDatosMockGlaciares(): GlaciarData[] {
    return [      {
        id: 'mock_1',
        nombre: 'Glaciar San Rafael',
        area: 4500,
        volumen: 225000,
        geometria: {
          type: 'Polygon',
          coordinates: [[
            [-73.8, -46.7],
            [-73.6, -46.7],
            [-73.6, -46.5],
            [-73.8, -46.5],
            [-73.8, -46.7]
          ]]
        },
        propiedades: { tipo: 'glaciar_marino' },
        latitud: -46.6,
        longitud: -73.7,
        tipo: 'Glaciar de valle',
        altura_media: 800,
        altura_maxima: 1200,
        altura_minima: 0,
        clasificacion: 'Glaciar de valle',
        region: 'Aysén',
        comuna: 'Tortel'
      },      {
        id: 'mock_2',
        nombre: 'Campo de Hielo Norte',
        area: 8200,
        volumen: 410000,
        geometria: {
          type: 'Polygon',
          coordinates: [[
            [-73.5, -47.0],
            [-73.2, -47.0],
            [-73.2, -46.8],
            [-73.5, -46.8],
            [-73.5, -47.0]
          ]]
        },
        propiedades: { tipo: 'campo_hielo' },
        latitud: -46.9,
        longitud: -73.35,
        tipo: 'Campo de hielo',
        altura_media: 1500,
        altura_maxima: 2000,
        altura_minima: 800,
        clasificacion: 'Campo de hielo',
        region: 'Aysén',
        comuna: 'Villa O\'Higgins'
      }
    ];
  }
}
