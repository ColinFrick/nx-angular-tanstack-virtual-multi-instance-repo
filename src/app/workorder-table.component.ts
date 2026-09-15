import {Component, ElementRef, Input, signal, viewChild,} from '@angular/core';
import {injectVirtualizer} from '@tanstack/angular-virtual';

export interface Workorder {
    id: string;
}

@Component({
    selector: 'app-workorder-table',
    standalone: true,
    template: `
        <section class="card">
            <header>
                <strong>{{ name }}</strong>
                <span>component #{{ instanceId }}</span>
            </header>

            <div class="diagnostics">
                <div>input count: <b>{{ workorders().length }}</b></div>
                <div>virtualizer count: <b>{{ virtualizer.options().count }}</b></div>
            </div>

            <div #scrollElement class="viewport">
                <div class="spacer" [style.height.px]="virtualizer.getTotalSize()">
                    @for (virtualRow of virtualizer.getVirtualItems(); track virtualRow.key) {
                        <div
                                class="row"
                                [style.transform]="'translateY(' + virtualRow.start + 'px)'"
                        >
                            {{ workorders()[virtualRow.index]?.id }}
                        </div>
                    }
                </div>
            </div>
        </section>
    `,
    styles: [`
        .card {
            border: 1px solid #3b3b3b;
            border-radius: 8px;
            padding: 10px;
            background: #181818;
        }

        header {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
            color: #ddd;
        }

        header span {
            color: #888;
            font-size: 12px;
        }

        .diagnostics {
            font-size: 12px;
            line-height: 1.6;
            margin-bottom: 8px;
            color: #aaa;
        }

        .viewport {
            height: 160px;
            overflow: auto;
            border: 1px solid #303030;
            position: relative;
        }

        .spacer {
            position: relative;
            width: 100%;
        }

        .row {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 32px;
            padding: 7px 8px;
            border-bottom: 1px solid #292929;
        }
    `],
})
export class WorkorderTableComponent {
    private static nextId = 0;

    readonly instanceId = ++WorkorderTableComponent.nextId;

    @Input({required: true}) name = '';

    private readonly _workorders = signal<Workorder[]>([]);
    readonly workorders = this._workorders.asReadonly();

    @Input({required: true, alias: 'workorders'})
    set workordersInput(value: Workorder[]) {
        this._workorders.set(value);
        console.log('INPUT', this.instanceId, value.length);
    }

    readonly scrollElement = viewChild<ElementRef<HTMLElement>>('scrollElement');

    readonly virtualizer = injectVirtualizer(() => {
        const count = this.workorders().length;
        console.log('VIRTUALIZER', this.instanceId, count);

        return {
            scrollElement: this.scrollElement(),
            count,
            estimateSize: () => 32,
            overscan: 2,
        };
    });
}
