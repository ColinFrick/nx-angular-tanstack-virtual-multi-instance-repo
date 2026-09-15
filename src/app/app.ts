import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {Workorder, WorkorderTableComponent} from "./workorder-table.component";

interface Column {
  id: string;
  workorders: Workorder[];
}

function workorders(count: number, prefix: string): Workorder[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
  }));
}

@Component({
  imports: [RouterModule, WorkorderTableComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly columns = signal<Column[]>([
    { id: 'C1', workorders: workorders(8, 'C1') },
    { id: 'C2', workorders: workorders(7, 'C2') },
    { id: 'C3', workorders: workorders(1, 'C3') },
    { id: 'C4', workorders: workorders(1, 'C4') },
    { id: 'C5', workorders: workorders(1, 'C5') },
  ]);

  constructor() {
    console.log('APP COMPONENT', this.columns());

    /*setTimeout(() => {
      this.columns.set([
        { id: 'C1', workorders: workorders(8, 'C1') },
        { id: 'C2', workorders: workorders(7, 'C2') },
        { id: 'C3', workorders: workorders(1, 'C3') },
        { id: 'C4', workorders: workorders(1, 'C4') },
        { id: 'C5', workorders: workorders(1, 'C5') },
      ]);
    }, 1000);*/
  }
}
