import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-historia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historia.component.html',
  styleUrls: ['./historia.component.scss']
})
export class HistoriaComponent {
  historiaText: string = `
    La historia de los glaciares patagónicos está marcada por grandes cambios climáticos y geológicos.
    Durante miles de años, su avance y retroceso han moldeado el paisaje, creando valles, lagos y fiordos.

    Los registros de los pueblos originarios y los estudios científicos actuales permiten reconstruir
    la evolución de estos gigantes de hielo y su impacto en la vida local y global.

    En el pasado, los glaciares cubrían extensas áreas de la Patagonia, y su retroceso dejó huellas visibles en la geografía actual.
    Las investigaciones modernas, junto con los relatos ancestrales, ayudan a entender cómo el clima ha cambiado y cómo
    las comunidades se han adaptado a lo largo del tiempo.`;

  showQuestions = false;

  preguntas = [
    {
      texto: '¿Qué han permitido los registros de pueblos originarios y estudios científicos?',
      opciones: [
        'Reconstruir la evolución de los glaciares',
        'Descubrir oro',
        'Construir ciudades',
        'Nada relevante'
      ],
      respuesta: 'Reconstruir la evolución de los glaciares',
      seleccionada: '',
      respondida: false
    },
    {
      texto: '¿Qué huellas dejaron los glaciares en la Patagonia?',
      opciones: [
        'Ninguna',
        'Valles, lagos y fiordos',
        'Montañas artificiales',
        'Desiertos'
      ],
      respuesta: 'Valles, lagos y fiordos',
      seleccionada: '',
      respondida: false
    }
  ];

  responderPregunta(q: any) {
    q.respondida = true;
  }
}
