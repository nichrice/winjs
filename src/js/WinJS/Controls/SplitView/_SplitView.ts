// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.

import _Dispose = require('../../Utilities/_Dispose');
import _Global = require('../../Core/_Global');
import _Base = require('../../Core/_Base');
import _BaseUtils = require('../../Core/_BaseUtils');
import _Events = require('../../Core/_Events');
import _ErrorFromName = require('../../Core/_ErrorFromName');
import _Control = require('../../Utilities/_Control');
import _Hoverable = require('../../Utilities/_Hoverable');
import _ElementUtilities = require('../../Utilities/_ElementUtilities');
import Promise = require('../../Promise');
import _Signal = require('../../_Signal');
import Animations = require('../../Animations');
import _TransitionAnimation = require('../../Animations/_TransitionAnimation');

declare var require: any;
require(["require-style!less/controls"]);

"use strict";

interface IRect {
    left: number;
    top: number;
    contentWidth: number;
    contentHeight: number
    totalWidth: number;
    totalHeight: number;
}

export interface IThickness {
    content: number;
    total: number;
}

var Strings = {
    get duplicateConstruction() { return "Invalid argument: Controls may only be instantiated one time for each DOM element"; }
};
var ClassNames = {
    splitView: "win-splitview",
    pane: "win-splitview-pane",
    content: "win-splitview-content",
    // hidden/shown
    paneHidden: "win-splitview-pane-hidden",
    paneShown: "win-splitview-pane-shown",

    _rtl: "win-splitview-rtl",
    _panePlaceholder: "win-splitview-paneplaceholder",
    _paneWrapper: "win-splitview-panewrapper",
    // placement
    _placementLeft: "win-splitview-placementleft",
    _placementRight: "win-splitview-placementright",
    _placementTop: "win-splitview-placementtop",
    _placementBottom: "win-splitview-placementbottom",
    // display mode
    _inlineMode: "win-splitview-inlinemode",
    _overlayMode: "win-splitview-overlaymode"
};
var EventNames = {
    beforeShow: "beforeshow",
    afterShow: "aftershow",
    beforeHide: "beforehide",
    afterHide: "afterhide"
};
var Dimension = {
    width: "width",
    height: "height"
};

var ShownDisplayMode = {
    /// <field locid="WinJS.UI.SplitView.ShownDisplayMode.overlay" helpKeyword="WinJS.UI.SplitView.ShownDisplayMode.overlay">
    /// When the pane is shown, it doesn't take up any space and it is light dismissable.
    /// </field>
    overlay: "overlay",
    /// <field locid="WinJS.UI.SplitView.ShownDisplayMode.inline" helpKeyword="WinJS.UI.SplitView.ShownDisplayMode.inline">
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
var shownDisplayModeClassMap = {};
shownDisplayModeClassMap[ShownDisplayMode.overlay] = ClassNames._overlayMode;
shownDisplayModeClassMap[ShownDisplayMode.inline] = ClassNames._inlineMode;
var placementClassMap = {};
placementClassMap[Placement.left] = ClassNames._placementLeft;
placementClassMap[Placement.right] = ClassNames._placementRight;
placementClassMap[Placement.top] = ClassNames._placementTop;
placementClassMap[Placement.bottom] = ClassNames._placementBottom;

// Versions of add/removeClass that are no ops when called with falsy class names.
function addClass(element: HTMLElement, className: string): void {
    className && _ElementUtilities.addClass(element, className);
}
function removeClass(element: HTMLElement, className: string): void {
    className && _ElementUtilities.removeClass(element, className);
}

function rectToThickness(rect: IRect, dimension: string): IThickness {
    return (dimension === Dimension.width) ? {
        content: rect.contentWidth,
        total: rect.totalWidth
    }: {
        content: rect.contentHeight,
        total: rect.totalHeight
    };
}

// Returns a promise which completes when *element* is in the DOM.
function inDom(element: HTMLElement): Promise<any> {
    return new Promise(function (c) {
        if (_Global.document.body.contains(element)) {
            c();
        } else {
            var nodeInsertedHandler = () => {
                element.removeEventListener("WinJSNodeInserted", nodeInsertedHandler, false);
                c();
            };
            _ElementUtilities._addInsertedNotifier(element);
            element.addEventListener("WinJSNodeInserted", nodeInsertedHandler, false);
        }
    });
}

//
// Resize animation
//  The resize animation requires 2 animations to run simultaneously in sync with each other. It's implemented
//  without PVL because PVL doesn't provide a way to guarantee that 2 animations will start at the same time.
//

function transformWithTransition(element: HTMLElement, transition: { to: string; duration: number; timing: string; }): Promise<any> {
    var duration = transition.duration * _TransitionAnimation._animationFactor;
    element.style.transition = duration + "ms transform " + transition.timing;
    element.style.transform = transition.to;

    return new Promise((c) => {
        var finish = function () {
            clearTimeout(timeoutId);
            element.removeEventListener("transitionend", finish);
            element.style.transition = "";
            c();
        };

        // Watch dog timeout
        var timeoutId = _Global.setTimeout(function () {
            timeoutId = _Global.setTimeout(finish, duration);
        }, 50);

        element.addEventListener("transitionend", finish);
    });
}

function growTransition(elementClipper: HTMLElement, element: HTMLElement, options: { from: IThickness; to: IThickness; dimension: string; inverted: boolean; }): Promise<any> {
    var diff = options.inverted ? options.to.total - options.from.total : options.from.total - options.to.total;
    var translate = options.dimension === Dimension.width ? "translateX" : "translateY";
    var size = options.dimension;

    // Set up
    elementClipper.style[size] = options.to.total + "px";
    elementClipper.style.transform = translate + "(" + diff + "px)";
    element.style[size] = options.to.content + "px";
    element.style.transform = translate + "(" + -diff + "px)";

    // Resolve styles
    getComputedStyle(elementClipper).opacity;
    getComputedStyle(element).opacity;
    
    // Animate
    var transition = {
        duration: 367,
        timing: "cubic-bezier(0.1, 0.9, 0.2, 1)",
        to: ""
    };
    return Promise.join([
        transformWithTransition(elementClipper,  transition),
        transformWithTransition(element, transition)
    ]);
}

function shrinkTransition(elementClipper: HTMLElement, element: HTMLElement, options: { from: IThickness; to: IThickness; dimension: string; inverted: boolean; }): Promise<any> {
    var diff = options.inverted ? options.from.total - options.to.total : options.to.total - options.from.total;
    var translate = options.dimension === Dimension.width ? "translateX" : "translateY";

    // Set up
    elementClipper.style.transform = "";
    element.style.transform = "";

    // Resolve styles
    getComputedStyle(elementClipper).opacity;
    getComputedStyle(element).opacity;

    // Animate
    var transition = {
        duration: 367,
        timing: "cubic-bezier(0.1, 0.9, 0.2, 1)"
    };
    var clipperTransition = _BaseUtils._merge(transition, { to: translate + "(" + diff + "px)" });
    var elementTransition = _BaseUtils._merge(transition, { to: translate + "(" + -diff + "px)" });
    return Promise.join([
        transformWithTransition(elementClipper, clipperTransition),
        transformWithTransition(element, elementTransition)
    ]);
}

function resizeTransition(elementClipper: HTMLElement, element: HTMLElement, options: { from: IThickness; to: IThickness; dimension: string; inverted: boolean; }): Promise<any> {
    if (options.to.total > options.from.total) {
        return growTransition(elementClipper, element, options);
    } else if (options.to.total < options.from.total) {
        return shrinkTransition(elementClipper, element, options);
    }
}

// WinJS animation promises always complete successfully. This
// helper allows an animation promise to complete in the canceled state
// so that the success handler can be skipped when the animation is
// interrupted.
function cancelablePromise(animationPromise: Promise<any>) {
    return Promise._cancelBlocker(animationPromise, function () {
        animationPromise.cancel();
    });
}

function showEdgeUI(elements: any, offsets: any): Promise<any> {    
    return cancelablePromise(Animations.showEdgeUI(elements, offsets, { mechanism: "transition" }));
}

function hideEdgeUI(elements: any, offsets: any): Promise<any> {
    return cancelablePromise(Animations.hideEdgeUI(elements, offsets, { mechanism: "transition" }));
}

function fadeIn(elements: any): Promise<any> {
    return cancelablePromise(Animations.fadeIn(elements));
}

//
// State machine
//

function _() { }

function interruptible<T>(object: T, workFn: (promise: Promise<any>, object: T) => Promise<any>) {
    object["_interruptibleWorkPromises"] = object["_interruptibleWorkPromises"] || [];
    var workStoredSignal = new _Signal();
    object["_interruptibleWorkPromises"].push(workFn(workStoredSignal.promise, object));
    workStoredSignal.complete();
}

function cancelInterruptibles() {
    (this["_interruptibleWorkPromises"] || []).forEach((workPromise: _Signal<any>) => {
        workPromise.cancel();
    });
}

interface ISplitViewState {
    // Debugging
    name: string;
    // State lifecyle
    enter(args: any): void;
    exit(): void;
    // SplitView's API surface
    hidden: boolean; // readyonly. Writes go thru showPane/hidePane.
    showPane(): void;
    hidePane(): void;
    // Misc
    updateDom(): void;
    // Provided by _setState for use within the state
    splitView: SplitView;
}

// Transitions:
//   When created, the control will take one of the following initialization transitions depending on
//   how the control's APIs have been used by the time it is inserted into the DOM:
//     Init -> Hidden
//     Init -> Shown
//   Following that, the life of the SplitView will be dominated by the following 3
//   sequences of transitions. In geneneral, these sequences are uninterruptible.
//     Hidden -> BeforeShow -> Hidden (when preventDefault is called on beforeshow event)
//     Hidden -> BeforeShow -> Showing -> Shown
//     Shown -> BeforeHide -> Hiding -> Hidden
//     Shown -> BeforeHide -> Shown (when preventDefault is called on beforehide event)
//   However, any state can be interrupted to go to the Disposed state:
//     * -> Disposed

module States {
    function updateDomImpl(): void {
        this.splitView._updateDomImpl();
    }
    
    // Initial state. Initializes state on the SplitView shared by the various states.
    export class Init implements ISplitViewState {
        private _hidden: boolean;
        
        splitView: SplitView;
        name = "Init";
        enter(options?: any) {
            interruptible(this, (ready) => {
                return ready.then(() => {
                    options = options || {};
        
                    this.splitView._cachedHiddenPaneThickness = null;
        
                    this.splitView.hidden = true;
                    this.splitView.shownDisplayMode = ShownDisplayMode.overlay;
                    this.splitView.placement = Placement.left;
                    _Control.setOptions(this.splitView, options);
                    
                    return inDom(this.splitView._dom.root).then(() => {
                        this.splitView._rtl = _Global.getComputedStyle(this.splitView._dom.root).direction === 'rtl';
                        if (this.splitView._rtl) {
                            _ElementUtilities.addClass(this.splitView._dom.root, ClassNames._rtl);
                        }
                        this.splitView._isShownMode = !this._hidden;
                        this.splitView._updateDomImpl();
                        this.splitView._setState(this._hidden ? Hidden : Shown);
                    });
                });
            });
        }
        exit = cancelInterruptibles;
        get hidden(): boolean {
            return this._hidden;
        }
        showPane() {
            this._hidden = false;
        }
        hidePane() {
            this._hidden = true;
        }
        updateDom = _; // Postponed until immediately before we switch to another state
    }
    
    // A rest state. The SplitView pane is hidden and is waiting for the app to call showPane.
    class Hidden implements ISplitViewState {
        splitView: SplitView;
        name = "Hidden";
        enter(args?: { showIsPending?: boolean; }) {
            args = args || {};
            if (args.showIsPending) {
                this.showPane();
            }
        }
        exit = _;
        hidden = true;
        showPane() {
            this.splitView._setState(BeforeShow);
        }
        hidePane = _;
        updateDom = updateDomImpl;
    }
    
    // An event state. The SplitView fires the beforeshow event.
    class BeforeShow implements ISplitViewState {
        splitView: SplitView;
        name = "BeforeShow";
        enter() {
            interruptible(this, (ready) => {
                return ready.then(() => {
                    return this.splitView._fireBeforeShow(); // Give opportunity for chain to be canceled when calling into app code
                }).then((shouldShow) => {
                    if (shouldShow) {
                        this.splitView._setState(Showing);
                    } else {
                        this.splitView._setState(Hidden);
                    }
                });
            });
        }
        exit = cancelInterruptibles;
        hidden = true;
        showPane = _;
        hidePane = _;
        updateDom = updateDomImpl;
    }
    
    // An animation/event state. The SplitView plays its show animation and fires aftershow.
    class Showing implements ISplitViewState {
        private _hideIsPending: boolean;

        splitView: SplitView;
        name = "Showing";
        enter() {
            interruptible(this, (ready) => {
                return ready.then(() => {
                    this._hideIsPending = false;
                    
                    this.splitView._cachedHiddenPaneThickness = null;
                    var hiddenPaneThickness = this.splitView._getHiddenPaneThickness();
                    
                    this.splitView._isShownMode = true;
                    this.splitView._updateDomImpl();
                    return this.splitView._playShowAnimation(hiddenPaneThickness);
                }).then(() => {
                    this.splitView._fireEvent(EventNames.afterShow); // Give opportunity for chain to be canceled when calling into app code
                }).then(() => {
                    this.splitView._updateDomImpl();
                    this.splitView._setState(Shown, { hideIsPending: this._hideIsPending });
                });
            });
        }
        exit = cancelInterruptibles;
        get hidden() {
            return this._hideIsPending;
        }
        showPane() {
            this._hideIsPending = false;
        }
        hidePane() {
            this._hideIsPending = true;
        }
        updateDom = _; // Postponed until immediately before we switch to another state
    }
    
    // A rest state. The SplitView pane is shown and is waiting for the app to trigger hidePane.
    class Shown implements ISplitViewState {
        splitView: SplitView;
        name = "Shown";
        enter(args?: { hideIsPending?: boolean }) {
            args = args || {};
            if (args.hideIsPending) {
                this.hidePane();
            }
        }
        exit = _;
        hidden = false;
        showPane = _;
        hidePane() {
            this.splitView._setState(BeforeHide);
        }
        updateDom = updateDomImpl;
    }
    
    // An event state. The SplitView fires the beforehide event.
    class BeforeHide implements ISplitViewState {
        splitView: SplitView;
        name = "BeforeHide";
        enter() {
            interruptible(this, (ready) => {
                return ready.then(() => {
                    return this.splitView._fireBeforeHide(); // Give opportunity for chain to be canceled when calling into app code
                }).then((shouldHide) => {
                    if (shouldHide) {
                        this.splitView._setState(Hiding);
                    } else {
                        this.splitView._setState(Shown);
                    }
                });
            });
        }
        exit = cancelInterruptibles;
        hidden = false;
        showPane = _;
        hidePane = _;
        updateDom = updateDomImpl;
    }
    
    // An animation/event state. The SpitView plays the hide animation and fires the afterhide event.
    class Hiding implements ISplitViewState {
        private _showIsPending: boolean;

        splitView: SplitView;
        name = "Hiding";
        enter() {
            interruptible(this, (ready) => {
                return ready.then(() => {
                    this._showIsPending = false;
                    return this.splitView._playHideAnimation(this.splitView._getHiddenPaneThickness());
                }).then(() => {
                    this.splitView._isShownMode = false;
                    this.splitView._updateDomImpl();
                    this.splitView._fireEvent(EventNames.afterHide); // Give opportunity for chain to be canceled when calling into app code
                }).then(() => {
                    this.splitView._updateDomImpl();
                    this.splitView._setState(Hidden, { showIsPending: this._showIsPending });
                });
            });
        }
        exit = cancelInterruptibles;
        get hidden() {
            return !this._showIsPending;
        }
        showPane() {
            this._showIsPending = true;
        }
        hidePane() {
            this._showIsPending = false;
        }
        updateDom = _; // Postponed until immediately before we switch to another state
    }

    export class Disposed implements ISplitViewState {
        splitView: SplitView;
        name = "Disposed";
        enter() {
        }
        exit = _;
        hidden = true;
        showPane = _;
        hidePane = _;
        updateDom = _;
    }
}

/// <field>
/// <summary locid="WinJS.UI.SplitView">
/// Displays a SplitView which renders a collapsable pane next to arbitrary HTML content.
/// </summary>
/// </field>
/// <icon src="ui_winjs.ui.splitview.12x12.png" width="12" height="12" />
/// <icon src="ui_winjs.ui.splitview.16x16.png" width="16" height="16" />
/// <htmlSnippet supportsContent="true"><![CDATA[<div data-win-control="WinJS.UI.SplitView"></div>]]></htmlSnippet>
/// <event name="beforeshow" locid="WinJS.UI.SplitView_e:beforeshow">Raised just before showing the pane. Call preventDefault on this event to stop the pane from being shown.</event>
/// <event name="aftershow" locid="WinJS.UI.SplitView_e:aftershow">Raised immediately after the pane is fully shown.</event>
/// <event name="beforehide" locid="WinJS.UI.SplitView_e:beforehide">Raised just before hiding the pane. Call preventDefault on this event to stop the pane from being hidden.</event>
/// <event name="afterhide" locid="WinJS.UI.SplitView_e:afterhide">Raised immediately after the pane is fully hidden.</event>
/// <part name="splitview" class="win-splitview" locid="WinJS.UI.SplitView_part:splitview">The entire SplitView control.</part>
/// <part name="splitview-pane" class="win-splitview-pane" locid="WinJS.UI.SplitView_part:splitview-pane">The element which hosts the SplitView's pane.</part>
/// <part name="splitview-content" class="win-splitview-content" locid="WinJS.UI.SplitView_part:splitview-content">The element which hosts the SplitView's content.</part>
/// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/base.js" shared="true" />
/// <resource type="javascript" src="//$(TARGET_DESTINATION)/js/ui.js" shared="true" />
/// <resource type="css" src="//$(TARGET_DESTINATION)/css/ui-dark.css" shared="true" />
export class SplitView {
    /// <field locid="WinJS.UI.SplitView.ShownDisplayMode" helpKeyword="WinJS.UI.SplitView.ShownDisplayMode">
    /// Display options for a SplitView's pane.
    /// </field>
    static ShownDisplayMode = ShownDisplayMode;

    /// <field locid="WinJS.UI.SplitView.Placement" helpKeyword="WinJS.UI.SplitView.Placement">
    /// Placement options for a SplitView's pane.
    /// </field>
    static Placement = Placement;

    static supportedForProcessing: boolean = true;

    private _disposed: boolean;
    private _state: ISplitViewState;
    _dom: {
        root: HTMLElement;
        pane: HTMLElement;
        paneWrapper: HTMLElement; // Shouldn't have any margin, padding, or border.
        panePlaceholder: HTMLElement; // Shouldn't have any margin, padding, or border.
        content: HTMLElement; 
    };
    _isShownMode: boolean; // Is ClassNames.paneShown present on the SplitView?
    _rtl: boolean;
    _cachedHiddenPaneThickness: IThickness;

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

        this._initializeDom(element || _Global.document.createElement("div"));
        this._setState(States.Init, options);
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
        return this._dom.pane;
    }

    /// <field type="HTMLElement" domElement="true" readonly="true" hidden="true" locid="WinJS.UI.SplitView.contentElement" helpKeyword="WinJS.UI.SplitView.contentElement">
    /// Gets the DOM element that hosts the SplitView's content.
    /// </field>
    get contentElement(): HTMLElement {
        return this._dom.content;
    }

    private _shownDisplayMode: string;
    /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.ShownDisplayMode" locid="WinJS.UI.SplitView.shownDisplayMode" helpKeyword="WinJS.UI.SplitView.shownDisplayMode">
    /// Gets or sets the display mode of the SplitView's pane.
    /// </field>
    get shownDisplayMode(): string {
        return this._shownDisplayMode;
    }
    set shownDisplayMode(value: string) {
        if (ShownDisplayMode[value] && this._shownDisplayMode !== value) {
            this._shownDisplayMode = value;
            this._cachedHiddenPaneThickness = null;
            this._state.updateDom();
        }
    }

    private _placement: string;
    /// <field type="String" oamOptionsDatatype="WinJS.UI.SplitView.Placement" locid="WinJS.UI.SplitView.placement" helpKeyword="WinJS.UI.SplitView.placement">
    /// Gets or sets the placement of the SplitView's pane.
    /// </field>
    get placement(): string {
        return this._placement;
    }
    set placement(value: string) {
        if (Placement[value] && this._placement !== value) {
            this._placement = value;
            this._cachedHiddenPaneThickness = null;
            this._state.updateDom();
        }
    }
    
    /// <field type="Boolean" hidden="true" locid="WinJS.UI.SplitView.hidden" helpKeyword="WinJS.UI.SplitView.hidden">
    /// True if the SpitView's pane is currently collapsed.
    /// </field>
    get hidden(): boolean {
        return this._state.hidden;
    }
    set hidden(value: boolean) {
        if (value) {
            this.hidePane();
        } else {
            this.showPane();
        }
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
        this._setState(States.Disposed);
        this._disposed = true;
        _Dispose._disposeElement(this._dom.pane);
        _Dispose._disposeElement(this._dom.content);
    }

    showPane(): void {
        /// <signature helpKeyword="WinJS.UI.SplitView.showPane">
        /// <summary locid="WinJS.UI.SplitView.showPane">
        /// Shows the SplitView's pane.
        /// </summary>
        /// </signature>
        this._state.showPane();
    }

    hidePane(): void {
        /// <signature helpKeyword="WinJS.UI.SplitView.hidePane">
        /// <summary locid="WinJS.UI.SplitView.hidePane">
        /// Hides the SplitView's pane.
        /// </summary>
        /// </signature>
        this._state.hidePane();
    }

    private _initializeDom(root: HTMLElement): void {
        // The first child is the pane
        var paneEl = <HTMLElement>root.firstElementChild || _Global.document.createElement("div");
        _ElementUtilities.addClass(paneEl, ClassNames.pane);
        
        // All other children are members of the content
        var contentEl = _Global.document.createElement("div");
        _ElementUtilities.addClass(contentEl, ClassNames.content);
        var child = paneEl.nextSibling;
        while (child) {
            var sibling = child.nextSibling;
            contentEl.appendChild(child);
            child = sibling;
        }
        
        // paneWrapper's purpose is to clip the pane during the pane resize animation
        var paneWrapperEl = _Global.document.createElement("div");
        paneWrapperEl.className = ClassNames._paneWrapper;
        paneWrapperEl.appendChild(paneEl);
        
        var panePlaceholderEl = _Global.document.createElement("div");
        panePlaceholderEl.className = ClassNames._panePlaceholder;

        root["winControl"] = this;
        _ElementUtilities.addClass(root, ClassNames.splitView);
        _ElementUtilities.addClass(root, "win-disposable");
        _ElementUtilities.addClass(root, ClassNames.paneHidden);
        
        this._dom = {
            root: root,
            pane: paneEl,
            paneWrapper: paneWrapperEl,
            panePlaceholder: panePlaceholderEl,
            content: contentEl
        };
        // Nothing has been rendered yet so these are all undefined. Because
        // they are undefined, the first time _updateDomImpl is called, they
        // will all be rendered.
        this._rendered = {
            paneIsFirst: undefined,
            isShownMode: undefined,
            shownDisplayMode: undefined,
            placement: undefined,
            panePlaceholderWidth: undefined,
            panePlaceholderHeight: undefined
        };
    }
    
    private _measureElement(element: HTMLElement): IRect {
        var style = getComputedStyle(element);
        var position = _ElementUtilities._getPositionRelativeTo(element, this._dom.root);
        var marginLeft = parseInt(style.marginLeft, 10);
        var marginTop = parseInt(style.marginTop, 10);
        return {
            left: position.left - marginLeft,
            top: position.top - marginTop,
            contentWidth: _ElementUtilities.getContentWidth(element),
            contentHeight: _ElementUtilities.getContentHeight(element),
            totalWidth: _ElementUtilities.getTotalWidth(element),
            totalHeight: _ElementUtilities.getTotalHeight(element)
        };
    }
    
    private _setContentRect(contentRect: IRect) {
        var contentStyle = this._dom.content.style;
        contentStyle.left = contentRect.left + "px";
        contentStyle.top = contentRect.top + "px";
        contentStyle.height = contentRect.contentHeight + "px";
        contentStyle.width = contentRect.contentWidth + "px";
    }
    
    private _prepareAnimation(paneRect: IRect, contentRect: IRect): void {
        var paneWrapperStyle = this._dom.paneWrapper.style;
        paneWrapperStyle.position = "absolute";
        paneWrapperStyle.zIndex = "1";
        paneWrapperStyle.left = paneRect.left + "px";
        paneWrapperStyle.top = paneRect.top + "px";
        paneWrapperStyle.height = paneRect.totalHeight + "px";
        paneWrapperStyle.width = paneRect.totalWidth + "px";
        
        var contentStyle = this._dom.content.style;
        contentStyle.position = "absolute";
        contentStyle.zIndex = "0";
        this._setContentRect(contentRect);
    }
    
    private _clearAnimation(): void {
        var paneWrapperStyle = this._dom.paneWrapper.style;
        paneWrapperStyle.position = "";
        paneWrapperStyle.zIndex = "";
        paneWrapperStyle.left = "";
        paneWrapperStyle.top = "";
        paneWrapperStyle.height = "";
        paneWrapperStyle.width = "";
        paneWrapperStyle.transform = "";
        
        var contentStyle = this._dom.content.style;
        contentStyle.position = "";
        contentStyle.zIndex = "";
        contentStyle.left = "";
        contentStyle.top = "";
        contentStyle.height = "";
        contentStyle.width = "";
        contentStyle.transform = "";
        
        var paneStyle = this._dom.pane.style;
        paneStyle.height = "";
        paneStyle.width = "";
        paneStyle.transform = "";
    }
    
    private _getHiddenContentRect(shownContentRect: IRect, hiddenPaneThickness: IThickness, shownPaneThickness: IThickness): IRect {
        if (this.shownDisplayMode === ShownDisplayMode.overlay) {
            return shownContentRect;
        } else {
            var placementRight = this._rtl ? Placement.left : Placement.right;
            var sign = this.placement === placementRight || this.placement === Placement.bottom ? 0 : 1;
            var paneDiff = {
                content: shownPaneThickness.content - hiddenPaneThickness.content,
                total: shownPaneThickness.total - hiddenPaneThickness.total
            };
            return this._horizontal ? {
                left: shownContentRect.left - sign * paneDiff.total,
                top: shownContentRect.top,
                contentWidth: shownContentRect.contentWidth + paneDiff.content,
                contentHeight: shownContentRect.contentHeight,
                totalWidth: shownContentRect.totalWidth + paneDiff.total,
                totalHeight: shownContentRect.totalHeight
            } : {
                left: shownContentRect.left,
                top: shownContentRect.top - sign * paneDiff.total,
                contentWidth: shownContentRect.contentWidth,
                contentHeight: shownContentRect.contentHeight + paneDiff.content,
                totalWidth: shownContentRect.totalWidth,
                totalHeight: shownContentRect.totalHeight + paneDiff.total
            }
        }
    }
    
    private _getAnimationOffsets(shownPaneRect: IRect): { top: string; left: string; } {
        var placementLeft = this._rtl ? Placement.right : Placement.left;
        return this._horizontal ? {
            left: (this.placement === placementLeft ? -1 : 1) * shownPaneRect.totalWidth + "px",
            top: "0px"
        } : {
            left: "0px",
            top: (this.placement === Placement.top ? -1 : 1) * shownPaneRect.totalHeight + "px"
        };
    }
    
    private _paneSlideIn(shownPaneRect: IRect): Promise<any> {
        return showEdgeUI(this._dom.paneWrapper, this._getAnimationOffsets(shownPaneRect));
    }

    private _paneSlideOut(shownPaneRect: IRect): Promise<any> {
        return hideEdgeUI(this._dom.paneWrapper, this._getAnimationOffsets(shownPaneRect));
    }

    //
    // Methods called by states
    //

    get _horizontal(): boolean {
        return this.placement === Placement.left || this.placement === Placement.right;
    }
    
    _setState(NewState: any, arg0?: any) {
        if (!this._disposed) {
            this._state && this._state.exit();
            this._state = new NewState();
            this._state.splitView = this;
            this._state.enter(arg0);
        }
    }

    // Calls into arbitrary app code
    _fireEvent(eventName: string, options?: { detail?: any; cancelable?: boolean; }): boolean {
        options = options || {};
        var detail = options.detail || null;
        var cancelable = !!options.cancelable;

        var eventObject = <CustomEvent>_Global.document.createEvent("CustomEvent");
        eventObject.initCustomEvent(eventName, true, cancelable, detail);
        return this._dom.root.dispatchEvent(eventObject);
    }

    // Calls into arbitrary app code
    _fireBeforeShow(): boolean {
        return this._fireEvent(EventNames.beforeShow, {
            cancelable: true
        });
    }

    // Calls into arbitrary app code
    _fireBeforeHide(): boolean {
        return this._fireEvent(EventNames.beforeHide, {
            cancelable: true
        });
    }

    _getHiddenPaneThickness(): IThickness {
        if (this._cachedHiddenPaneThickness === null) {
            if (this._isShownMode) {
                _ElementUtilities.removeClass(this._dom.root, ClassNames.paneShown);
                _ElementUtilities.addClass(this._dom.root, ClassNames.paneHidden);
            }
            var size = this._measureElement(this._dom.pane);
            this._cachedHiddenPaneThickness = rectToThickness(size, this._horizontal ? Dimension.width : Dimension.height);
            if (this._isShownMode) {
                _ElementUtilities.removeClass(this._dom.root, ClassNames.paneHidden);
                _ElementUtilities.addClass(this._dom.root, ClassNames.paneShown);
            }
        }

        return this._cachedHiddenPaneThickness;
    }
    
    // Should be called while SplitView is rendered in its shown mode
    _playShowAnimation(hiddenPaneThickness: IThickness): Promise<any> {
        var dim = this._horizontal ? Dimension.width : Dimension.height;
        var shownPaneRect = this._measureElement(this._dom.pane);
        var shownContentRect = this._measureElement(this._dom.content);
        var shownPaneThickness = rectToThickness(shownPaneRect, dim);
        var hiddenContentRect = this._getHiddenContentRect(shownContentRect, hiddenPaneThickness, shownPaneThickness);
        this._prepareAnimation(shownPaneRect, hiddenContentRect);
        
        var playPaneAnimation = (): Promise<any> => {
            var peek = hiddenPaneThickness.total > 0;
            
            if (peek) {
                var placementRight = this._rtl ? Placement.left : Placement.right;
                return resizeTransition(this._dom.paneWrapper, this._dom.pane, {
                    from: hiddenPaneThickness,
                    to: shownPaneThickness,
                    dimension: dim,
                    inverted: this.placement === placementRight || this.placement === Placement.bottom
                });
            } else {
                return this._paneSlideIn(shownPaneRect);
            }
        };
        
        var playShowAnimation = (): Promise<any> => {
            if (this.shownDisplayMode === ShownDisplayMode.overlay) {
                return playPaneAnimation();
            } else {
                var fadeInDelay = 350 * _TransitionAnimation._animationFactor;
                
                var contentAnimation = Promise.timeout(fadeInDelay).then(() => {
                    this._setContentRect(shownContentRect);
                    return fadeIn(this._dom.content);
                });
                
                return Promise.join([contentAnimation, playPaneAnimation()]);
            }
        };
        
        return playShowAnimation().then(() => {
            this._clearAnimation();
        });
    }
    
    // Should be called while SplitView is rendered in its shown mode
    _playHideAnimation(hiddenPaneThickness: IThickness): Promise<any> {
        var dim = this._horizontal ? Dimension.width : Dimension.height;
        var shownPaneRect = this._measureElement(this._dom.pane);
        var shownContentRect = this._measureElement(this._dom.content);
        var shownPaneThickness = rectToThickness(shownPaneRect, dim);
        var hiddenContentRect = this._getHiddenContentRect(shownContentRect, hiddenPaneThickness, shownPaneThickness);
        this._prepareAnimation(shownPaneRect, shownContentRect);
        
        var playPaneAnimation = (): Promise<any> => {
            var peek = hiddenPaneThickness.total > 0;
            
            if (peek) {
                var placementRight = this._rtl ? Placement.left : Placement.right;
                return resizeTransition(this._dom.paneWrapper, this._dom.pane, {
                    from: shownPaneThickness,
                    to: hiddenPaneThickness,
                    dimension: dim,
                    inverted: this.placement === placementRight || this.placement === Placement.bottom
                });
            } else {
                return this._paneSlideOut(shownPaneRect);
            }
        };
        
        var playHideAnimation = (): Promise<any> => {
            if (this.shownDisplayMode === ShownDisplayMode.overlay) {
                return playPaneAnimation();
            } else {                
                var fadeInDelay = 267 * _TransitionAnimation._animationFactor;
                
                var contentAnimation = Promise.timeout(fadeInDelay).then(() => {
                    this._setContentRect(hiddenContentRect);
                    return fadeIn(this._dom.content);
                });
                
                return Promise.join([contentAnimation, playPaneAnimation()]);
            }
        };

        
        return playHideAnimation().then(() => {
            this._clearAnimation();
        });
    }
    
    private _rendered: {
        paneIsFirst: boolean;
        isShownMode: boolean;
        shownDisplayMode: string;
        placement: string;
        panePlaceholderWidth: string;
        panePlaceholderHeight: string;
    }
    _updateDomImpl(): void {
        var paneShouldBeFirst = this.placement === Placement.left || this.placement === Placement.top;
        if (paneShouldBeFirst !== this._rendered.paneIsFirst) {
            // TODO: restore focus
            if (paneShouldBeFirst) {
                this._dom.root.appendChild(this._dom.panePlaceholder);
                this._dom.root.appendChild(this._dom.paneWrapper);
                this._dom.root.appendChild(this._dom.content);
            } else {
                this._dom.root.appendChild(this._dom.content);
                this._dom.root.appendChild(this._dom.paneWrapper);
                this._dom.root.appendChild(this._dom.panePlaceholder);
            }
        }
        this._rendered.paneIsFirst = paneShouldBeFirst;
        
        if (this._rendered.isShownMode !== this._isShownMode) {
            if (this._isShownMode) {
                _ElementUtilities.removeClass(this._dom.root, ClassNames.paneHidden);
                _ElementUtilities.addClass(this._dom.root, ClassNames.paneShown);
            } else {
                _ElementUtilities.removeClass(this._dom.root, ClassNames.paneShown);
                _ElementUtilities.addClass(this._dom.root, ClassNames.paneHidden);
            }
        }
        this._rendered.isShownMode = this._isShownMode;
        
        if (this._rendered.placement !== this.placement) {
            removeClass(this._dom.root, placementClassMap[this._rendered.placement]);
            addClass(this._dom.root, placementClassMap[this.placement]);
            this._rendered.placement = this.placement;
        }

        if (this._rendered.shownDisplayMode !== this.shownDisplayMode) {
            removeClass(this._dom.root, shownDisplayModeClassMap[this._rendered.shownDisplayMode]);
            addClass(this._dom.root, shownDisplayModeClassMap[this.shownDisplayMode]);
            this._rendered.shownDisplayMode = this.shownDisplayMode;
        }
        
        // panePlaceholder's purpose is to take up the amount of space occupied by the
        // hidden pane while the pane is shown in overlay mode. Without this, the content
        // would shift as the pane shows and hides in overlay mode.
        var width: string, height: string;
        if (this._isShownMode && this.shownDisplayMode === ShownDisplayMode.overlay) {
            var hiddenPaneThickness = this._getHiddenPaneThickness();
            if (this._horizontal) {
                width = hiddenPaneThickness.total + "px";
                height = "";
            } else {
                width = "";
                height = hiddenPaneThickness.total + "px";
            }
        } else {
            width = "";
            height = "";
        }
        if (this._rendered.panePlaceholderWidth !== width || this._rendered.panePlaceholderHeight !== height) {
            var style = this._dom.panePlaceholder.style;
            style.width = width;
            style.height = height;
            this._rendered.panePlaceholderWidth = width;
            this._rendered.panePlaceholderHeight = height;
        }
    }
}

_Base.Class.mix(SplitView, _Events.createEventProperties(
    EventNames.beforeShow,
    EventNames.afterShow,
    EventNames.beforeHide,
    EventNames.afterHide
));
_Base.Class.mix(SplitView, _Control.DOMEventMixin);
