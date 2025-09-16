import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DatosClimaticos, Temperatura } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class ClimaService {
  private readonly API_BASE = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene datos climáticos actuales desde el backend (OpenMeteo)
   */
  obtenerDatosClimaActuales(): Observable<DatosClimaticos> {
    return this.http.get<any>(`${this.API_BASE}/temperatura/openmeteo`, {
      params: {
        lat: '-45.5',
        lon: '-72.0'
      }
    }).pipe(
      map(response => ({
        temperatura: {
          actual: response.actual.temperatura,
          pasada: response.actual.temperatura - 1.5,
          futura: response.actual.temperatura + 2.5,
          delta: 4.0,
          unidad: '°C',
          fecha: new Date().toISOString()
        },
        humedad: response.actual.humedad,
        precipitacion: 0,
        viento: {
          velocidad: response.actual.viento_velocidad,
          direccion: response.actual.viento_direccion
        },
        ubicacion: {
          latitud: response.ubicacion.latitud,
          longitud: response.ubicacion.longitud,
          nombre: 'Región de Aysén'
        }
      } as DatosClimaticos)),
      catchError(error => {
        console.error('Error obteniendo datos climáticos del backend:', error);
        return of(this.getDatosMockClimaticos());
      })
    );
  }

  private getDatosMockClimaticos(): DatosClimaticos {
    return {
      temperatura: {
        actual: 8.5,
        pasada: 7.0,
        futura: 11.0,
        delta: 4.0,
        unidad: '°C',
        fecha: new Date().toISOString()
      },
      humedad: 75,
      precipitacion: 0,
      viento: {
        velocidad: 15,
        direccion: 225
      },
      ubicacion: {
        latitud: -45.5,
        longitud: -72.0,
        nombre: 'Región de Aysén'
      }
    };
  }
}
