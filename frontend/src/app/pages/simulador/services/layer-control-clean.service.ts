import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LayerState {
  temperatura: boolean;
  icebergs: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LayerControlService {
  private layerStateSubject = new BehaviorSubject<LayerState>({
    temperatura: true,
    icebergs: true
  });

  public layerState$: Observable<LayerState> = this.layerStateSubject.asObservable();

  constructor() { }

  /**
   * Obtiene el estado actual de las capas
   */
  getCurrentState(): LayerState {
    return this.layerStateSubject.value;
  }

  /**
   * Alterna la visibilidad de la capa de temperatura
   */
  toggleTemperatura(): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      temperatura: !currentState.temperatura
    });
  }

  /**
   * Alterna la visibilidad de la capa de icebergs
   */
  toggleIcebergs(): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      icebergs: !currentState.icebergs
    });
  }

  /**
   * Establece el estado de una capa específica
   */
  setLayerState(layer: 'temperatura' | 'icebergs', visible: boolean): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      [layer]: visible
    });
  }

  /**
   * Establece el estado completo de las capas
   */
  setAllLayersState(state: LayerState): void {
    this.layerStateSubject.next(state);
  }
}
