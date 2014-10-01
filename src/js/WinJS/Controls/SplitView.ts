// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.

import _Dispose = require('../Utilities/_Dispose');
import _Global = require('../Core/_Global');
import _Base = require('../Core/_Base');
import _Events = require('../Core/_Events');
import _ErrorFromName = require('../Core/_ErrorFromName');
import _Control = require('../Utilities/_Control');
import _Hoverable = require('../Utilities/_Hoverable');

// TODO: Do we need to require 'require-style!less/controls'?

"use strict";

var Strings = {
    get duplicateConstruction() { return "Invalid argument: Controls may only be instantiated one time for each DOM element"; }
};
var ClassNames = {
    splitView: "win-splitview",
    pane: "win-splitview-pane",
	content: "win-splitview-content",
	paneHidden: "win-splitview-panehidden"
};
var EventNames = {
    beforeShow: "beforeshow",
    afterShow: "aftershow",
    beforeHide: "beforehide",
    afterHide: "afterhide"
};
// TODO: switch to enum? con: lose string debuggability. pro: gain type checking for properties.
var PaneDisplayMode = {
    /// <field locid="WinJS.UI.SplitView.PaneDisplayMode.overlay" helpKeyword="WinJS.UI.SplitView.PaneDisplayMode.overlay">
    /// When the pane is shown, it doesn't take up any space and it is light dismissable.
    /// </field>
    overlay: "overlay",
    /// <field locid="WinJS.UI.SplitView.PaneDisplayMode.inline" helpKeyword="WinJS.UI.SplitView.PaneDisplayMode.inline">
    /// When the pane is shown, it occupies space leaving less room for the SplitView's content.
    /// </field>
    inline: "inline"
};
var Placement = {
    /// <field locid="WinJS.UI.SplitView.Placement.left" helpKeyword="WinJS.UI.SplitView.Placement.left">
    /// Pane is positioned left of the SplitView's content.
    /// </field>
    left: "left",
    /// <field locid="WinJS.UI.SplitView.Placement.right" helpKeyword="WinJS.UI.SplitView.Placement.right">
    /// Pane is positioned right of the SplitView's content.
    /// </field>
    right: "right",
    /// <field locid="WinJS.UI.SplitView.Placement.top" helpKeyword="WinJS.UI.SplitView.Placement.top">
    /// Pane is positioned above the SplitView's content.
    /// </field>
    top: "top",
    /// <field locid="WinJS.UI.SplitView.Placement.bottom" helpKeyword="WinJS.UI.SplitView.Placement.bottom">
    /// Pane is positioned below the SplitView's content.
    /// </field>
    bottom: "bottom"
};

/// <field>
/// <summary locid="WinJS.UI.SplitView">
/// Displays a modal dialog which can display arbitrary HTML content.
/// </summary>
/// </field>
/// <icon src="ui_winjs.ui.splitview.12x12.png" width="12" height="12" />
/// <icon src="ui_winjs.ui.splitview.16x16.png" width="16" height="16" />

// TODO: Fill in htmlSnippet tag based on what the developer can specify as the content of the SplitView.

/// <htmlSnippet supportsContent="true"><![CDATA[<div data-win-control="WinJS.UI.SplitView"></div>]]></htmlSnippet>
/// <event name="beforeshow" locid="WinJS.UI.SplitView_e:beforeshow">Raised just before showing the pane. Call preventDefault on this event to stop the pane from being shown.</event>
/// <event name="aftershow" locid="WinJS.UI.SplitView_e:aftershow">Raised immediately after a dialog is fully shown.</event>
/// <event name="beforehide" locid="WinJS.UI.SplitView_e:beforehide">Raised just before hiding the pane. Call preventDefault on this event to stop the pane from being hidden.</event>
/// <event name="afterhide" locid="WinJS.UI.SplitView_e:afterhide">Raised immediately after a dialog is fully hidden.</event>
/// <part name="splitview" class="win-splitview" locid="WinJS.UI.SplitView_part:splitview">The entire SplitView control.</part>
/// <part name="splitview-pane" class="win-splitview-pane" locid="WinJS.UI.SplitView_part:splitview-pane">The element which hosts the SplitView's pane.</part>
/// <part name="splitview-content" class="win-splitview-content" locid="WinJS.UI.SplitView_part:splitview-content">The element which hosts the SplitView's content.</part>
/// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/base.js" shared="true" />
/// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/ui.js" shared="true" />
/// <resource type="css" src="//$(TARGET_DESTINATION)/css/ui-dark.css" shared="true" />
export class SplitView {
	private _disposed: boolean;
	private _dom: any;
	
	constructor(element?: HTMLElement, options: any = {}) {            
        /// <signature helpKeyword="WinJS.UI.SplitView.SplitView">
        /// <summary locid="WinJS.UI.SplitView.constructor">
        /// Creates a new SplitView control.
        /// </summary>
        /// <param name="element" type="HTMLElement" domElement="true" isOptional="true" locid="WinJS.UI.SplitView.constructor_p:element">
        /// The DOM element that hosts the SplitView control.
        /// </param>
        /// <param name="options" type="Object" isOptional="true" locid="WinJS.UI.SplitView.constructor_p:options">
        /// An object that contains one or more property/value pairs to apply to the new control.
        /// Each property of the options object corresponds to one of the control's properties or events.
        /// Event names must begin with "on". For example, to provide a handler for the beforehide event,
        /// add a property named "onbeforehide" to the options object and set its value to the event handler.
        /// </param>
        /// <returns type="WinJS.UI.SplitView" locid="WinJS.UI.SplitView.constructor_returnValue">
        /// The new SplitView.
        /// </returns>
        /// </signature>

        // Check to make sure we weren't duplicated
        if (element && element["winControl"]) {
            throw new _ErrorFromName("WinJS.UI.SplitView.DuplicateConstruction", Strings.duplicateConstruction);
        }
        
        this._disposed = false;
        
        this.paneDisplayMode = PaneDisplayMode.overlay;
        this.placement = Placement.left;

        _Control.setOptions(this, options);
	}
	
    /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.element" helpKeyword="WinJS.UI.SplitView.element">
    /// Gets the DOM element that hosts the SplitView control.
    /// </field>
	get element(): HTMLElement {
        return this._dom.root;
	}
                
    /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.paneElement" helpKeyword="WinJS.UI.SplitView.paneElement">
    /// Gets the DOM element that hosts the SplitView pane.
    /// </field>
    get paneElement(): HTMLElement {
    	return this._dom.root;
    }
                
    /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.contentElement" helpKeyword="WinJS.UI.SplitView.contentElement">
    /// Gets the DOM element that hosts the SplitView's content.
    /// </field>
    get contentElement(): HTMLElement {
    	return this._dom.root;
    }
                
    /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.PaneDisplayMode" locid="WinJS.UI.SplitView.paneDisplayMode" helpKeyword="WinJS.UI.SplitView.paneDisplayMode">
    /// Gets or sets the display mode of the SplitView's pane.
    /// </field>
    get paneDisplayMode(): string {
		return "";
    }
    set paneDisplayMode(value: string) {
    }
                
    /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.Placement" locid="WinJS.UI.SplitView.placement" helpKeyword="WinJS.UI.SplitView.placement">
    /// Gets or sets the placement of the SplitView's pane.
    /// </field>
    get placement(): string {
		return "";
	}
    set placement(value: string) {
    }

	dispose(): void {
	    /// <signature helpKeyword="WinJS.UI.SplitView.dispose">
	    /// <summary locid="WinJS.UI.SplitView.dispose">
	    /// Disposes this control.
	    /// </summary>
	    /// </signature>
	    if (this._disposed) {
	        return;
	    }
	    this._disposed = true;
	}

    showPane(): void {
        /// <signature helpKeyword="WinJS.UI.SplitView.showPane">
        /// <summary locid="WinJS.UI.SplitView.showPane">
        /// Shows the SplitView's pane.
        /// </summary>
        /// </signature>
    }

    hidePane(): void {
        /// <signature helpKeyword="WinJS.UI.SplitView.hidePane">
        /// <summary locid="WinJS.UI.SplitView.hidePane">
        /// Hides the SplitView's pane.
        /// </summary>
        /// </signature>
    }

	private _initializeDom(root: HTMLElement): void {
	}
	
	/// <field locid="WinJS.UI.SplitView.PaneDisplayMode" helpKeyword="WinJS.UI.SplitView.PaneDisplayMode">
    /// Display options for a SplitView's pane.
    /// </field>
	static PaneDisplayMode = PaneDisplayMode;
	
	/// <field locid="WinJS.UI.SplitView.Placement" helpKeyword="WinJS.UI.SplitView.Placement">
	/// Placement options for a SplitView's pane.
	/// </field>
	static Placement = Placement;
	
	static supportedForProcessing: boolean = true;
}

_Base.Class.mix(SplitView, _Events.createEventProperties(
    EventNames.beforeShow,
    EventNames.afterShow,
    EventNames.beforeHide,
    EventNames.afterHide
));
_Base.Class.mix(SplitView, _Control.DOMEventMixin);
_Base.Namespace.define("WinJS.UI", {
	SplitView: SplitView
});
