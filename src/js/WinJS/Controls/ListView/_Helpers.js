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

    function cycleStrings(stringArray, count) {
        // Returns the result of continously concatenating each string in the array
        // until the specified number of concatenations are made.
        // e.g.
        //  cycleStrings(["a", "b", "c"], 7) ==> "abcabca"
        //  cycleStrings(["a", "b", "c"], 2) ==> "ab"
        //  cycleStrings(["a", "b", "c"], 0) ==> ""
        //  cycleStrings([], 99) ==> ""

        function recursiveHelper(strings, count) {
            var numStrings = strings.length;

            if (numStrings === 1) {
                // base case
                return new Array(count + 1).join(strings[0]);
            } else {
                var numFullCycles = Math.floor(count / numStrings),
                    numLeftOvers = count % numStrings,
                    compressedStrings = [strings.join("")],
                    result;

                // Make one recursive call with array of size 1 to trigger base case
                result = recursiveHelper(compressedStrings, numFullCycles);

                // final pass through for leftovers.
                for (var i = 0; i < numLeftOvers; i++) {
                    result += strings[i];
                }

                return result;
            }
        }

        if (stringArray.length && count > 0) {
            return recursiveHelper(stringArray, count)
        } else {
            return "";
        }
    }

    function stripedContainers(count, nextItemIndex) {
        if (count > 0) {
            var containersMarkup = "",
                evenStripe = _Constants._containerEvenClass,
                oddStripe = _Constants._containerOddClass,
                stripes = nextItemIndex % 2 === 0 ? [evenStripe, oddStripe] : [oddStripe, evenStripe];

            var pairOfContainers = [
                "<div class='win-container " + stripes[0] + " win-backdrop'></div>",
                "<div class='win-container " + stripes[1] + " win-backdrop'></div>"
            ];

            return cycleStrings(pairOfContainers, count);
        }
    }

    _Base.Namespace._moduleDefine(exports, "WinJS.UI", {
        _nodeListToArray: nodeListToArray,
        _repeat: repeat,
        _cycleStrings: cycleStrings,
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
