import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { SimulacionResultado } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class SimulacionService {
  private readonly API_BASE = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}
  /**
   * Inicia una simulación de deshielo
   */
  iniciarSimulacion(parametros: {
    temperatura?: number;
    tiempoSimulacion?: number;
    factorDeshielo?: number;
  } = {}): Observable<SimulacionResultado> {
    return this.http.post<SimulacionResultado>(`${this.API_BASE}/simulacion/iniciar`, parametros).pipe(
      catchError(error => {
        console.error('Error iniciando simulación:', error);
        throw error;
      })
    );
  }
  /**
   * Obtiene el estado de una simulación en curso
   */
  obtenerEstadoSimulacion(simulacionId: string): Observable<any> {
    return this.http.get(`${this.API_BASE}/simulacion/${simulacionId}`).pipe(
      catchError(error => {
        console.error('Error obteniendo estado de simulación:', error);
        throw error;
      })
    );
  }

  /**
   * Obtiene datos reales de glaciares desde el backend
   */
  obtenerDatosGlaciares(): Observable<any> {
    return this.http.get(`${this.API_BASE}/glaciares`).pipe(
      catchError(error => {
        console.error('Error obteniendo datos de glaciares:', error);
        throw error;
      })
    );
  }

  /**
   * Obtiene zonas de riesgo reales
   */
  obtenerZonasRiesgo(): Observable<any> {
    return this.http.get(`${this.API_BASE}/zonas-riesgo`).pipe(
      catchError(error => {
        console.error('Error obteniendo zonas de riesgo:', error);
        throw error;
      })
    );
  }
}
