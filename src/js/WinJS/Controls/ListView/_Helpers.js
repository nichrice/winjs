// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
define([
    'exports',
    '../../Core/_Base',
    '../ItemContainer/_Constants',
    '../../Animations'
], function helpersInit(exports, _Base, _Constants, Animations) {
    "use strict";

    function nodeListToArray(nodeList) {
        return Array.prototype.slice.call(nodeList);
    }

    function repeat(markup, count) {
        return new Array(count + 1).join(markup);
    }

    function stripedContainers(count, nextItemIndex) {
        if (count > 0) {
            var containersMarkup = "",
                evenStripe = _Constants._containerEvenClass,
                oddStripe = _Constants._containerOddClass,
                stripes = nextItemIndex % 2 === 0 ? [evenStripe, oddStripe] : [oddStripe, evenStripe];

            var numTuples = Math.floor(count / 2);
            if (numTuples) {
                var containersTuple = "<div class='win-container " + stripes[0] + " win-backdrop'></div>" +
                "<div class='win-container " + stripes[1] + " win-backdrop'></div>";
                containersMarkup += repeat(containersTuple, numTuples);
            }
            if (count % 2 !== 0) {
                containersMarkup += "<div class='win-container " + stripes[0] + " win-backdrop'></div>"
            }

            return containersMarkup;
        }
    }

    _Base.Namespace._moduleDefine(exports, "WinJS.UI", {
        _nodeListToArray: nodeListToArray,
        _repeat: repeat,
        _stripedContainers: stripedContainers,
        _ListViewAnimationHelper: {
            fadeInElement: function (element) {
                return Animations.fadeIn(element);
            },
            fadeOutElement: function (element) {
                return Animations.fadeOut(element);
            },
            animateEntrance: function (canvas, firstEntrance) {
                return Animations.enterContent(canvas, [{ left: firstEntrance ? "100px" : "40px", top: "0px", rtlflip: true }], { mechanism: "transition" });
            },
        }
    });
});
