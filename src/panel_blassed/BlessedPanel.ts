import * as blessed from "neo-blessed";
import { Widgets } from "neo-blessed";
import { sprintf } from "sprintf-js";

import { Panel } from "../panel/Panel";
import { Widget } from "./Widget";
import { Logger } from "../common/Logger";
import { StringUtils } from "../common/StringUtils";
import { PanelFileBox } from "./PanelFileBox";
import { ColorConfig } from "../config/ColorConfig";
import { Color } from "../common/Color";
import { Reader } from "../common/Reader";
import { KeyMapping } from "../config/KeyMapConfig";
import { KeyMappingInfo } from "../config/KeyMapConfig";
import { IBlessedView } from "./IBlessedView";
import mainFrame from './MainFrame';

const log = Logger("blessedpanel");

@KeyMapping( KeyMappingInfo.Panel, "Panel" )
export class BlessedPanel extends Panel implements IBlessedView {
    public fileBox: PanelFileBox[] = [];
    public baseWidget: Widget = null;
    public panel: Widget = null;
    public header: Widget = null;
    public tailer: Widget = null;
    
    private _fileViewType = 0;
    private _lines = [];

    constructor( opts: Widgets.BoxOptions | any, reader: Reader = null ) {
        super( reader );
        const statColor = ColorConfig.instance().getBaseColor("stat");

        this.baseWidget = new Widget( { ...opts } );

        this.panel = new Widget({
            parent: this.baseWidget,
            border: "line",
            left: 0,
            top: 1,
            width: "100%",
            height: "100%-1"
        });

        this.header = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: 0,
            width: "100%",
            height: 1,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });

        this.tailer = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: "100%",
            width: "100%",
            height: 1,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });
        this.initRender();
    }

    getReader(): Reader {
        return this.reader;
    }

    setReader( reader: Reader ) {
        super.setReader( reader );
    }

    hide() {
        this.baseWidget.hide();
    }

    show() {
        this.baseWidget.show();
    }

    destroy() {
        log.debug( "PANEL - destroy()" );
        this.panel.destroy();
        this.header.destroy();
        this.tailer.destroy();
        this.baseWidget.destroy();
        this.baseWidget = null;
    }

    getWidget() {
        return this.baseWidget;
    }

    setFocus() {
        this.panel.setFocus();
    }

    hasFocus(): boolean {
        return this.panel.hasFocus();
    }

    initRender() {
        log.info( "initRender : fileBox.size : %d", this.fileBox.length );
        this.panel.on( "prerender", () => {
            log.debug( "Panel prerender !!! - Start %d", this.baseWidget._viewCount );
            this.resize();
            this.beforeRender();
            log.debug( "BlessedPanel prerender !!! - End %d", this.baseWidget._viewCount);
        });
        this.header.on( "prerender", () => {
            log.debug( "header prerender !!! - Start %d", this.baseWidget._viewCount );
            if ( this._currentDir ) {
                this.header.setContent( this._currentDir.fullname );
            }
        });
        this.tailer.on( "prerender", () => {
            log.debug( "tailer prerender !!! - Start %d", this.baseWidget._viewCount );
            if ( !this.dirFiles ) {
                return;
            }
            const dirSize = this.dirFiles.filter( i => i.dir ).length;
            const fileSize = this.dirFiles.filter( i => !i.dir ).length;
            const allFileSize = this.dirFiles.filter( i => !i.dir ).reduce((v, t) => v + t.size, 0);

            this.tailer.setContentFormat( "{bold}%5s{/bold} Files {bold}%5s{/bold} Dir {bold}%20s{/bold} Byte", StringUtils.toregular(fileSize), StringUtils.toregular(dirSize), StringUtils.toregular(allFileSize) );
        });
        this.baseWidget.on("detach", () => {
            log.debug( "panel detach !!! - %d", this.baseWidget._viewCount );
        });
    }

    resize() {
        const MAX_COLUMN = 6;

        this.viewColumn = 0;

        const dirLength = this.dirFiles.length;
        const viewHeight = this.baseWidget.height as number - 2;
        if ( this.viewColumn === 0 || this.viewColumn > 6 ) {
            if ( dirLength <= this.baseWidget.height ) {
                this.column = 1;
            } else if ( dirLength <= (viewHeight * 2) ) {
                this.column = 2;
            } else if ( dirLength <= (viewHeight * 3) ) {
                this.column = 3;
            } else if ( dirLength <= (viewHeight * 4) ) {
                this.column = 4;
            } else if ( dirLength <= (viewHeight * 5) ) {
                this.column = 5;
            } else {
                this.column = 6;
            }
            const columnSize = Math.round(this.baseWidget.width as number / MAX_COLUMN);
            if ( this.column > columnSize ) {
                this.column = columnSize;
            }
        } else {
            this.column = this.viewColumn;
        }

        const row = Math.round((dirLength + this.column - 1) / this.column);
        if ( row <= (this.panel.height as number) - 2 ) {
            this.row = row;
        } else {
            this.row = this.panel.height as number - 2;
        }

        this.fileBox.map( item => {
            item.destroy();
        });
        this.fileBox = [];
        for ( let n = 0; n < this.column * this.row; n++ ) {
            this.fileBox.push( new PanelFileBox( { parent: this.panel as any, focusable: true }, this._fileViewType ) );
        }
        log.info( "init Render : COL:%d, ROW:%d, PAGE:%d, currentPos:%d fileBoxLen: %d - viewHeight: %d", this.column, this.row, this.page, this.currentPos, this.fileBox.length, viewHeight );
    }

    beforeRender() {
        log.info( "BlessedPanel beforeRender() - COL: %d, ROW: %d", this.column, this.row );

        if ( this.column !== 0 && this.row !== 0 ) {
            this.page = Math.floor(this.currentPos / (this.column * this.row));
        }
        let curPos = (this.column * this.row) * this.page;
        const itemWidth = Math.floor((this.baseWidget.width as number - (this.column * 2)) / this.column);

        this._lines.map( (item) => {
            item.destroy();
        });
        this._lines = [];

        let num = 0;
        for ( let col = 0; col < this.column; col++ ) {
            for ( let row = 0; row < this.row; row++ ) {
                const fileBox = this.fileBox[num++];
                fileBox.height = 1;
                fileBox.width = itemWidth;
                fileBox.top = row;
                // fileBox.left = col * (fileBox.width + 2);
                fileBox.left = col * (itemWidth + 2);
                if ( curPos < this.dirFiles.length ) {
                    // log.debug( "SET_POS: %d, CUR_POS: %d", curPos, this.currentPos );
                    fileBox.setFile( this.dirFiles[curPos], (curPos === this.currentPos && this.panel.hasFocus()), curPos );
                } else {
                    fileBox.setFile( null, false, -1 );
                }
                curPos++;
            }

            if ( col > 0 ) {
                this._lines.push(blessed.line({
                                        parent: this.panel.box,
                                        orientation: "vertical",
                                        type: "bg",
                                        ch: "│",
                                        left: (col * (itemWidth + 2)) - 1,
                                        top: 0,
                                        height: "100%-2"
                                    }));
            }
        }
        log.info( "FileBox: CUR: %d SIZE: %d", this.currentPos, this.fileBox.length );
    }   

    render() {
        this.baseWidget.render();
    }

    commandBoxShow() {
        mainFrame().commandBoxShow();
    }
}
