import Delta from 'quill-delta';
import Quill from '../core/quill';
import Module from '../core/module';
import {
    TableCell,
    TableRow,
    TableBody,
    TableContainer,
    TableHead,
    THead,
    HeadRow,
    tableId,
} from '../formats/table';

class Table extends Module {
    static register() {
        Quill.register(TableCell);
        Quill.register(TableRow);
        Quill.register(TableBody);
        Quill.register(TableContainer);
        Quill.register(TableHead);
        Quill.register(THead);
        Quill.register(HeadRow);
    }

    constructor(...args) {
        super(...args);
        this.listenBalanceCells();
    }

    balanceTables() {
        this.quill.scroll.descendants(TableContainer).forEach(table => {
            table.balanceCells();
        });
    }

    deleteColumn() {
        const [table, , cell] = this.getTable();
        if (cell == null) return;
        table.deleteColumn(cell.cellOffset());
        this.quill.update(Quill.sources.USER);
        this._updateOriginalTable(table.domNode);
    }

    deleteRow() {
        const [, row] = this.getTable();
        if (row == null) return;
        row.remove();
        this.quill.update(Quill.sources.USER);
        // Table (parent.parent)
        // - Table container (parent)
        //  - Row
        this._updateOriginalTable(row.parent.parent.domNode);
    }

    deleteTable() {
        const [table] = this.getTable();
        if (table == null) return;
        const offset = table.offset();
        table.remove();
        this.quill.update(Quill.sources.USER);
        this.quill.setSelection(offset, Quill.sources.SILENT);
    }

    getTable(range = this.quill.getSelection()) {
        if (range == null) return [null, null, null, -1];
        const [cell, offset] = this.quill.getLine(range.index);
        if (cell == null || cell.statics.blotName !== TableCell.blotName) {
            return [null, null, null, -1];
        }
        const row = cell.parent;
        const table = row.parent.parent;
        return [table, row, cell, offset];
    }

    insertColumn(offset) {
        const range = this.quill.getSelection();
        const [table, row, cell] = this.getTable(range);
        if (cell == null) return;
        const column = cell.cellOffset();
        table.insertColumn(column + offset);
        table.domNode.rows[0].children[column + offset].textContent = 'Header';
        this.quill.update(Quill.sources.USER);
        let shift = row.rowOffset();
        if (offset === 0) {
            shift += 1;
        }
        this.quill.setSelection(
            range.index + shift,
            range.length,
            Quill.sources.SILENT,
        );
        this._updateOriginalTable(table.domNode);
    }

    insertColumnLeft() {
        this.insertColumn(0);
    }

    insertColumnRight() {
        this.insertColumn(1);
    }

    insertRow(offset) {
        const range = this.quill.getSelection();
        const [table, row, cell] = this.getTable(range);
        if (cell == null) return;
        const index = row.rowOffset();
        if ((index + offset) === 0) {
            return;
        }
        table.insertRow(index + offset);
        this.quill.update(Quill.sources.USER);
        if (offset > 0) {
            this.quill.setSelection(range, Quill.sources.SILENT);
        } else {
            this.quill.setSelection(
                range.index + row.children.length,
                range.length,
                Quill.sources.SILENT,
            );
        }
        this._updateOriginalTable(table.domNode);
    }

    canAddRowAbove() {
        const range = this.quill.getSelection();
        const [table, row, cell] = this.getTable(range);
        if (cell == null) return;
        const index = row.rowOffset();
        return index !== 0;
    }

    insertRowAbove() {
        this.insertRow(0);
    }

    insertRowBelow() {
        this.insertRow(1);
    }

    insertTable(rows, columns) {
        const range = this.quill.getSelection();
        if (range == null) return;
        const delta = new Array(rows).fill(0).reduce(memo => {
            const text = new Array(columns).fill('\n').join('');
            return memo.insert(text, { table: tableId() });
        }, new Delta().retain(range.index));
        this.quill.updateContents(delta, Quill.sources.USER);
        this.quill.setSelection(range.index, Quill.sources.SILENT);
        this.balanceTables();
    }

    listenBalanceCells() {
        this.quill.on(Quill.events.SCROLL_OPTIMIZE, mutations => {
            mutations.some(mutation => {
                if (
                    ['TD', 'TR', 'TBODY', 'TABLE', 'THEAD', 'TH'].includes(
                        mutation.target.tagName,
                    )
                ) {
                    this.quill.once(Quill.events.TEXT_CHANGE, (delta, old, source) => {
                        if (source !== Quill.sources.USER) return;
                        this.balanceTables();
                    });
                    return true;
                }
                return false;
            });
        });
    }

    _updateOriginalTable(table) {
        this.quill.originalTable = table;
        this.quill.editor.originalTable = table;
    }
}

export default Table;
