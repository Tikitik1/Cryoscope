import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cosmovision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cosmovision.component.html',
  styleUrls: ['./cosmovision.component.scss']
})
export class CosmovisionComponent {
  cosmovisionText: string = `
    La cosmovisión de los pueblos originarios de la Patagonia está profundamente ligada a la naturaleza y los elementos.
    Los glaciares, montañas y ríos son considerados entidades vivas y sagradas, habitadas por espíritus protectores como los Ngen.

    Para los mapuche, el equilibrio y el respeto por el entorno son fundamentales. El agua, el hielo y la tierra forman parte de un ciclo vital
    que debe ser cuidado y honrado a través de rituales y prácticas ancestrales. Los relatos orales y las ceremonias transmiten el conocimiento
    y la importancia de mantener la armonía con la naturaleza.

    Esta visión del mundo invita a comprender los glaciares no solo desde la ciencia, sino también desde la espiritualidad y la cultura.
    El respeto por los Ngen y los elementos naturales es clave para la supervivencia y el bienestar de las comunidades.`;

  showQuestions = false;

  preguntas = [
    {
      texto: '¿Qué representan los glaciares y ríos en la cosmovisión de los pueblos originarios?',
      opciones: [
        'Son solo recursos de agua',
        'Entidades vivas y sagradas',
        'Obstáculos para la vida',
        'No tienen importancia'
      ],
      respuesta: 'Entidades vivas y sagradas',
      seleccionada: '',
      respondida: false
    },
    {
      texto: '¿Cómo se transmite el conocimiento sobre la naturaleza en estas culturas?',
      opciones: [
        'Por televisión',
        'Por relatos orales y ceremonias',
        'Por internet',
        'No se transmite'
      ],
      respuesta: 'Por relatos orales y ceremonias',
      seleccionada: '',
      respondida: false
    }
  ];

  responderPregunta(q: any) {
    q.respondida = true;
  }
}
