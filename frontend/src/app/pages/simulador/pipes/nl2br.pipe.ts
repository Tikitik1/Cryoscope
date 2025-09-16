import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'nl2br',
  standalone: true
})
export class Nl2brPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    
    return value
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Texto en negrita
      .replace(/\n/g, '<br>') // Saltos de línea
      .replace(/•/g, '&bull;'); // Bullets
  }
}
