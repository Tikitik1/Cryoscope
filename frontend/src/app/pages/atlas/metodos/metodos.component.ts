import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-metodos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './metodos.component.html',
  styleUrls: ['./metodos.component.scss']
})
export class MetodosComponent {
  metodosText: string = `
    El estudio de los glaciares combina métodos tradicionales y tecnología moderna: observación directa, relatos orales,
    imágenes satelitales y sensores remotos. Los pueblos originarios han transmitido su conocimiento a través de generaciones,
    observando el comportamiento de los hielos, el clima y la naturaleza circundante.

    Científicos y comunidades locales colaboran para monitorear el retroceso glaciar, entender su impacto y buscar
    soluciones para la adaptación al cambio climático. Se utilizan drones, estaciones meteorológicas y sensores remotos
    para obtener datos precisos sobre el estado de los glaciares y su entorno.

    La integración de saberes ancestrales y ciencia es clave para proteger estos ecosistemas únicos. El diálogo entre
    la tradición y la tecnología permite una comprensión más profunda y estrategias de conservación más efectivas.
  `;

  showQuestions = false;

  preguntas = [
    {
      texto: '¿Qué métodos se utilizan actualmente para estudiar los glaciares?',
      opciones: [
        'Solo observación directa',
        'Imágenes satelitales, sensores remotos y observación directa',
        'Solo relatos orales',
        'Solo drones y robots'
      ],
      respuesta: 'Imágenes satelitales, sensores remotos y observación directa',
      seleccionada: '',
      respondida: false
    },
    {
      texto: '¿Por qué es importante integrar saberes ancestrales y ciencia en el estudio de los glaciares?',
      opciones: [
        'Para obtener una visión más completa y estrategias de conservación efectivas',
        'Porque la ciencia no es suficiente',
        'Solo por tradición',
        'No es importante integrarlos'
      ],
      respuesta: 'Para obtener una visión más completa y estrategias de conservación efectivas',
      seleccionada: '',
      respondida: false
    }
  ];

  responderPregunta(q: any) {
    q.respondida = true;
  }
}
