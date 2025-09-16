import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface DatosClimaComplementarios {
  comuna: string;
  latitud: number;
  longitud: number;
  precipitacion_mm: number;
  temperatura_media: number;
  humedad_relativa: number;
  velocidad_viento: number;
  direccion_viento: number;
  radiacion_solar: number;
  presion_atmosferica: number;
  indice_uv: number;
  visibilidad: number;
  nubosidad: number;
  punto_rocio: number;
  sensacion_termica: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClimaComplementarioService {
  private readonly API_BASE = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene datos climáticos complementarios
   */
  obtenerDatosClimaComplementarios(): Observable<DatosClimaComplementarios[]> {
    // Retornar datos vacíos por ahora
    return of([]);
  }

  /**
   * Obtiene color para representar precipitación
   */
  getColorPrecipitacion(precipitacion: number): string {
    if (precipitacion < 50) return '#FFE4B5';      // Seco - beige claro
    if (precipitacion < 100) return '#87CEEB';     // Medio - azul claro
    if (precipitacion < 200) return '#4682B4';     // Alto - azul
    return '#191970';                              // Muy alto - azul oscuro
  }
}