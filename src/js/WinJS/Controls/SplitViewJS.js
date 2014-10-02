// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
define([
    '../Utilities/_Dispose',
    '../Core/_Global',
    '../Core/_Base',
    '../Core/_Events',
    '../Core/_ErrorFromName',
    '../Utilities/_Control',
    '../Utilities/_Hoverable',
    'require-style!less/controls'
    ], function splitViewInit(_Dispose, _Global, _Base, _Events, _ErrorFromName, _Control, _Hoverable) {
    "use strict";

    _Base.Namespace.define("WinJS.UI", {
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
        SplitView: _Base.Namespace._lazy(function () {
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

            var SplitView = _Base.Class.define(function SplitView_ctor(element, options) {
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
                if (element && element.winControl) {
                    throw new _ErrorFromName("WinJS.UI.SplitView.DuplicateConstruction", Strings.duplicateConstruction);
                }
                options = options || {};
                
                this._disposed = false;
                
                this.paneDisplayMode = PaneDisplayMode.overlay;
                this.placement = Placement.left;
                
                _Control.setOptions(this, options);
            }, {
                /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.element" helpKeyword="WinJS.UI.SplitView.element">
                /// Gets the DOM element that hosts the SplitView control.
                /// </field>
                element: {
                    get: function SplitView_element_get() {
                        return this._dom.root;
                    }
                },
                
                /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.paneElement" helpKeyword="WinJS.UI.SplitView.paneElement">
                /// Gets the DOM element that hosts the SplitView pane.
                /// </field>
                paneElement: {
                    get: function SplitView_paneElement_get() {
                        return this._dom.root;
                    }
                },
                
                /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.contentElement" helpKeyword="WinJS.UI.SplitView.contentElement">
                /// Gets the DOM element that hosts the SplitView's content.
                /// </field>
                contentElement: {
                    get: function SplitView_contentElement_get() {
                        return this._dom.root;
                    }
                },
                
                /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.PaneDisplayMode" locid="WinJS.UI.SplitView.paneDisplayMode" helpKeyword="WinJS.UI.SplitView.paneDisplayMode">
                /// Gets or sets the display mode of the SplitView's pane.
                /// </field>
                paneDisplayMode: {
                    get: function SplitView_paneDisplayMode_get() {
                    },
                    set: function SplitView_paneDisplayMode_set(value) {
                    }
                },
                
                /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.Placement" locid="WinJS.UI.SplitView.placement" helpKeyword="WinJS.UI.SplitView.placement">
                /// Gets or sets the placement of the SplitView's pane.
                /// </field>
                placement: {
                    get: function SplitView_placement_get() {
                    },
                    set: function SplitView_placement_set(value) {
                    }
                },

                dispose: function SplitView_dispose() {
                    /// <signature helpKeyword="WinJS.UI.SplitView.dispose">
                    /// <summary locid="WinJS.UI.SplitView.dispose">
                    /// Disposes this control.
                    /// </summary>
                    /// </signature>
                    if (this._disposed) {
                        return;
                    }
                    this._disposed = true;
                },

                showPane: function SplitView_showPane() {
                    /// <signature helpKeyword="WinJS.UI.SplitView.showPane">
                    /// <summary locid="WinJS.UI.SplitView.showPane">
                    /// Shows the SplitView's pane.
                    /// </summary>
                    /// </signature>
                },

                hidePane: function SplitView_hidePane() {
                    /// <signature helpKeyword="WinJS.UI.SplitView.hidePane">
                    /// <summary locid="WinJS.UI.SplitView.hidePane">
                    /// Hides the SplitView's pane.
                    /// </summary>
                    /// </signature>
                },

                _initializeDom: function SplitView_initializeDom(root) {
                }
            }, {
                /// <field locid="WinJS.UI.SplitView.PaneDisplayMode" helpKeyword="WinJS.UI.SplitView.PaneDisplayMode">
                /// Display options for a SplitView's pane.
                /// </field>
                PaneDisplayMode: PaneDisplayMode,
                
                /// <field locid="WinJS.UI.SplitView.Placement" helpKeyword="WinJS.UI.SplitView.Placement">
                /// Placement options for a SplitView's pane.
                /// </field>
                Placement: Placement,
                
                _ClassNames: ClassNames
            });
            _Base.Class.mix(SplitView, _Events.createEventProperties(
                EventNames.beforeShow,
                EventNames.afterShow,
                EventNames.beforeHide,
                EventNames.afterHide
            ));
            _Base.Class.mix(SplitView, _Control.DOMEventMixin);
            return SplitView;
        })
    });
});
