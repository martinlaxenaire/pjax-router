/**
 * PJaxRouter v1.0.5
 * https://github.com/martinlaxenaire/pjax-router
 *
 * Author: Martin Laxenaire
 * https://www.martin-laxenaire.fr/
 *
 * */

"use strict";

/**
 * Set up our routing script
 *
 * @param params (object): parameters object with our container, event callbacks...
 *
 * @constructor
 */
function PJaxRouter(params) {
    // init the router object
    this.router = {
        history: [{
            href: window.location.href,
            title: document.title,
        }],
    };

    this.cache = [];

    this._isLoading = false;
    this._ajaxCalls = 0;

    this._transitionsManager = {
        override: false,
        overrideDuration: 50,
        isWaiting: false,
    };

    // could be useful to keep in cache our last link DOM element clicked
    this.lastLinkClicked = null;

    // used for our mutation observer
    this._mutations = {
        mutationObserver: null,
        isActive: false,
    };

    // init params
    this._initParams(params);

    // init events
    this._initEvents();
}


/*** INIT ***/

/**
 * Init global params
 *
 * @param params (object): parameters object with our container, event callbacks...
 *
 * @private
 */
PJaxRouter.prototype._initParams = function(params) {

    // default params
    this.params = {
        container: document.body,
        cancelNavigationClass: null,

        cacheLinks: null,
        cacheNavigatedPages: false,
        cacheLength: 10,

        onStart: {
            value: function() {}
        },
        onReady: {
            value: function() {}
        },
        onLeaving: {
            duration: 1000,
            value: function() {}
        },
        onWaiting: {
            value: function() {}
        },
        onError: {
            value: function() {}
        },
    };

    Object.assign(this.params, params);

    if(!this.params.container) {
        this.params.container = document.body;
    }
    this.container = this.params.container;

    // cache first page if needed
    if(this.params.cacheNavigatedPages) {
        this._cacheResponse(window.location.href, document.documentElement.innerHTML);
    }

    // cache link contents
    if(this.params.cacheLinks) {
        this._cacheContainerLinks();
    }
};

/**
 * Init all events necessited for navigation:
 * - window hashchange
 * - window popstate
 * - window click: check for all clicks, then filter if it's a link that has been clicked and if we should launch navigation
 *
 * - if available, sets the mutation observer (useful to know when our data are appended)
 *
 * @private
 */
PJaxRouter.prototype._initEvents = function() {
    // keep a ref to our router
    var self = this;

    // listen for hash chance
    window.addEventListener("hashchange", function() {
        // push datas in our router to test hash change in pop state
        self.router.history.push({
            href: window.location.href,
            title: document.title
        });
    });

    // popstate
    window.addEventListener("popstate", function() {
        // we need to check what page we are leaving and what page we will load
        var hrefLeaved, hrefCalled;
        hrefLeaved = self.router.history[self.router.history.length - 1].href;
        hrefCalled = window.location.href;

        // if we are going to a page with a hash, check if we are not already on that page
        // if we are leaving a page with a hash, check if we are really leaving that page
        var hrefLeavedWithoutHash, hrefCalledWithoutHash;
        var shouldStay = false;

        if(hrefLeaved.indexOf("#") != -1) {
            var hashPosition = hrefLeaved.indexOf("#");
            hrefLeavedWithoutHash = hrefLeaved.substring(0, hashPosition);
        }
        else {
            hrefLeavedWithoutHash = hrefLeaved;
        }

        if(hrefCalled.indexOf("#") != -1) {
            var hashPosition = hrefCalled.indexOf("#");
            hrefCalledWithoutHash = hrefCalled.substring(0, hashPosition);
        }
        else {
            hrefCalledWithoutHash = hrefCalled;
        }
        // we are staying on the same page
        if(hrefLeavedWithoutHash == hrefCalledWithoutHash) {
            shouldStay = true;
        }

        if (!shouldStay) {
            self._launchNavigation(window.location.href, false);
        }
    });

    // listen for click events and launch ajax navigation if we need to
    window.addEventListener("click", function(e) {
        var linkTarget = e.target;
        if(linkTarget.name !== 'A') {
            linkTarget = linkTarget.closest('a');
        }

        if(!linkTarget) {
            return;
        }

        var href = linkTarget.getAttribute("href");

        // check if its not a cancel nav link
        if(self.params.cancelNavigationClass && linkTarget.classList.contains(self.params.cancelNavigationClass)) {
            return;
        }

        // check if its not an email link
        if(href.indexOf("mailto:") !== -1) {
            return;
        }

        // check if it has a download attribute
        if(linkTarget.getAttribute("download")) {
            return;
        }

        // check if a key is active
        if(
            e.ctrlKey
            || e.metaKey
            || e.shiftKey
            || e.altKey
        ) {
            return;
        }

        // check if this is a link to the exact same page
        if(window.location.pathname === href || window.location.href === href) {
            e.preventDefault();
            e.stopPropagation();

            return;
        }

        self.lastLinkClicked = linkTarget;

        e.preventDefault();
        e.stopPropagation();

        // launch our navigation process
        self._launchNavigation(href, true);
    });

    // mutation observer
    if(!!window.MutationObserver) {
        this._mutations.isActive = true;

        this._mutations.mutationObserver = new MutationObserver(function(mutations, observer){
            // observe our mutations
            self._observedMutation(mutations);
        });
    }
};


/*** CACHING ***/

/**
 * Add an entry into our cache. An entry consists of:
 *  - the href
 *  - the content inside our defined container (as a string)
 *  - the page title
 *
 * @param href (string): href to load
 * @param response (string): our AJAX response
 *
 * @private
 */
PJaxRouter.prototype._cacheResponse = function(href, response) {
    var content = this._parseResponseContent(response);

    var cache = {
        href: href,
        HTMLContent: content,
        title: response.match(/<title[^>]*>([^<]+)<\/title>/)[1]
    };

    // if we reached cache limit, remove oldest entry
    if(this.cache.length >= this.params.cacheLength) {
        this.cache.splice(0, 1);
    }

    this.cache.push(cache);
};

/**
 * Each time this function gets called (on init and after a successful transition)
 * We check for our links element that need to be cached and make an AJAX call for each one of them
 * We then push the response in our cache array
 *
 * @private
 */
PJaxRouter.prototype._cacheContainerLinks = function() {
    var cachedLinks = this.container.querySelectorAll(this.params.cacheLinks);

    for(var i = 0; i < cachedLinks.length; i++) {
        var href = cachedLinks[i].href;

        // cache it only if it is not already in the cache
        var shouldCache = true;
        for(var j = 0; j < this.cache.length; j++) {
            if(href === this.cache[j].href) {
                shouldCache = false;
            }
        }

        if(shouldCache) {
            var self = this;
            this._AJAXCall(href, false, function(response, url) {
                self._cacheResponse(url, response);
            });
        }
    }
};


/*** ROUTING ***/


/*** start routing ***/

/**
 * Global navigation handler:
 * - Launches AJAX request and calls onStart parameter event
 * - Wait during onLeaving duration parameter value then:
 *     if AJAX request is done continue by calling _appendData()
 *     if we're still waiting for the data, call _waitForData()
 *
 *
 * @param href (string): URL to navigate to
 * @param shouldUpdateHistory (bool): whether the router history object should be updated (true by default, false when navigation has been triggered by back/forth browser history)
 *
 * @private
 */
PJaxRouter.prototype._launchNavigation = function(href, shouldUpdateHistory) {
    if(!this._isLoading) {
        // empty the old datas
        this.router.nextHTMLContent = null;

        // on before
        this.params.onStart.value(this.router.history[this.router.history.length - 1].href, href);

        // do we need to override default transition duration?
        var leavingDuration = this._transitionsManager.isOverriding ? this._transitionsManager.overrideDuration : this.params.onLeaving.duration;

        // no need to do a real routing if we already cached the page!
        if(this.cache.length > 0) {
            var cachedPage = null;
            for(var i = 0; i < this.cache.length; i++) {
                if(this.cache[i].href === href) {
                    cachedPage = this.cache[i];
                }
            }
        }

        if(cachedPage) {
            // simply set our router next html content so the process can go on
            this.router.nextHref = cachedPage.href;
            this.router.nextHTMLContent = cachedPage.HTMLContent;
            this.router.nextTitle = cachedPage.title;
        }
        else {
            this._routing(href, shouldUpdateHistory);
        }


        var self = this;
        setTimeout(function() {
            self.params.onLeaving.value(self.router.history[self.router.history.length - 1].href, href);

            if(self.router.nextHTMLContent) {
                self._appendData(shouldUpdateHistory);
            }
            else {
                self._waitForData(shouldUpdateHistory);
            }

        }, leavingDuration);
    }
};


/**
 * Parse our response and get the content
 *
 * @param response (string): our AJAX response
 *
 * @private
 */
PJaxRouter.prototype._parseResponseContent = function(response) {
    var tempHtml = document.createElement('html');
    tempHtml.innerHTML = response;

    var selector = "";
    if(this.container.getAttribute("id")) {
        selector = "#" + this.container.getAttribute("id");
    }
    else if(this.container.classList.length) {
        for(var i = 0; i < this.container.classList.length; i++) {
            selector += "." + this.container.classList[i];
        }
    }
    else {
        selector = this.container.tagName;
    }

    var content = tempHtml.querySelector(selector).innerHTML;
    tempHtml = null;

    return content;
};


/**
 * Before doing the navigation AJAX call we're resetting our nextHref and nextHTMLContent values
 * Then we launch the call
 *
 * @param href (string): URL to navigate to
 * @param shouldUpdateHistory (bool): whether the router history object should be updated (true by default, false when navigation has been triggered by back/forth browser history)
 *
 * @private
 */
PJaxRouter.prototype._routing = function(href, shouldUpdateHistory) {
    // init our routing
    this._isLoading = true;
    this.router.nextHref = null;

    // set next href
    if(href) {
        this.router.nextHref = href;
    }
    else if(this.router.history.length > 0) {
        this.router.nextHref = this.router.history[this.router.history.length - 1].href;
    }

    if(this.router.nextHref) {
        var self = this;
        this._AJAXCall(href, shouldUpdateHistory, function(response, url) {
            var content = self._parseResponseContent(response);

            self.router.nextHTMLContent = content;
            self.router.nextTitle = response.match(/<title[^>]*>([^<]+)<\/title>/)[1];

            if(self.params.cacheNavigatedPages) {
                // cache it only if it is not already in the cache
                var shouldCache = true;
                for(var j = 0; j < self.cache.length; j++) {
                    if(url === self.cache[j].href) {
                        shouldCache = false;
                    }
                }

                if(shouldCache) {
                    self._cacheResponse(url, response);
                }
            }
        });
    }
};


/**
 * This is where we're making our AJAX call and we're waiting for its response
 * Can call onWaiting and onError callbacks if necessary
 *
 * @param href (string): URL to navigate to
 * @param shouldUpdateHistory (bool): whether the router history object should be updated (true by default, false when navigation has been triggered by back/forth browser history)
 * @param callback (function): function to be executed once our AJAX call is successful
 *
 * @private
 */
PJaxRouter.prototype._AJAXCall = function(href, shouldUpdateHistory, callback) {
    // handling ajax
    var xhr = new XMLHttpRequest();

    var self = this;

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
            if(callback) {
                callback(xhr.response, xhr.responseURL);
            }
        }
        else if(xhr.readyState === 4 && xhr.status !== 404 && self._ajaxCalls < 4) {
            if(self._ajaxCalls === 0 && !self._transitionsManager.isWaiting) {
                self._transitionsManager.isWaiting = true;
                self.params.onWaiting.value(self.router.history[self.router.history.length - 1].href, self.router.nextHref);
            }

            self._ajaxCalls++;
            //self._routing(self.router.nextHref, shouldUpdateHistory, callback);
            self._routing(xhr.responseURL, shouldUpdateHistory, callback);
        }
        else if(xhr.readyState === 4) {
            self._resetRoutingState();

            self.params.onError.value(self.router.history[self.router.history.length - 1].href, self.router.nextHref);
        }
    };

    xhr.open("GET", href, true);
    xhr.setRequestHeader("Accept", "text/html");
    xhr.send(null);
};


/*** waiting during routing ***/

/**
 * Called when our AJAX request has exceeded the onLeaving duration time
 * Basically just sets up an interval to check if data have arrived
 *
 * @param shouldUpdateHistory (bool): whether the router history object should be updated (true by default, false when navigation has been triggered by back/forth browser history)
 *
 * @private
 */
PJaxRouter.prototype._waitForData = function(shouldUpdateHistory) {
    // if onWaiting has not been called yet
    if(!this._transitionsManager.isWaiting) {
        this._transitionsManager.isWaiting = true;
        this.params.onWaiting.value(this.router.history[this.router.history.length - 1].href, this.router.nextHref);
    }

    var self = this;
    var dataInterval = setInterval(function() {
        if(self.router.nextHTMLContent) {
            clearInterval(dataInterval);
            self._appendData(shouldUpdateHistory);
        }
    }, 1000);

};


/*** finishing the routing (appending the data) ***/

/**
 * * Check if data have been appended to our container, then call _newContentAdded()
 *
 * @param mutations (mutation object): see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
 *
 * @private
 * */
PJaxRouter.prototype._observedMutation = function(mutations) {
    // loop through all mutations
    // if mutation added one or more nodes to our container, we have appended the data
    for(var i = 0; i < mutations.length; i++) {
        // that's our content that has just been appended!
        if(mutations[i].addedNodes.length && mutations[i].target.isEqualNode(this.container)) {
            // stop listening to mutations until next navigation
            this._mutations.mutationObserver.disconnect();

            var self = this;
            setTimeout(function() {
                self._newContentAdded();
            }, 34); // wait for a couple tick just to be sure

            // stop for loop
            break;
        }
    }
};

/**
 * When data have been appended, just call our onReady callback and reset all AJAX call useful flags
 *
 * @private
 */
PJaxRouter.prototype._newContentAdded = function() {
    var self = this;
    setTimeout(function() {
        self.params.onReady.value(
            self.router.history[self.router.history.length - 2].href,
            self.router.history[self.router.history.length - 1].href
        );

        // reset ajax calls and loading flags
        self._resetRoutingState();

        // check for cached links
        if(self.params.cacheLinks) {
            self._cacheContainerLinks();
        }
    }, 0);
};

/**
 * We have received the response from our AJAX call, now we need to append the data and update our router object
 *
 * @param shouldUpdateHistory (bool): whether the router history object should be updated (true by default, false when navigation has been triggered by back/forth browser history)
 *
 * @private
 */
PJaxRouter.prototype._appendData = function(shouldUpdateHistory) {

    //var pageTitle = this.router.nextHTMLContent.match(/<title[^>]*>([^<]+)<\/title>/)[1];
    var pageTitle = this.router.nextTitle;

    // handle history with pushState
    if(shouldUpdateHistory) {
        window.history.pushState({}, pageTitle, this.router.nextHref);
    }
    document.title = pageTitle;

    // keep trace of navigation inside our router
    this.router.history.push({
        href: this.router.nextHref,
        title: pageTitle
    });
    var content = this.router.nextHTMLContent;

    var self = this;

    if(content) {
        if(this._mutations.isActive) {
            // start observing mutation to detect when the data will be appended
            this._mutations.mutationObserver.observe(this.container, {
                childList: true,
            });
        }
        else {
            // if no mutation observer just set a time out
            setTimeout(function() {
                self._newContentAdded();
            }, content.children.length * 25);
        }

        // append our new content
        this.container.innerHTML = content;
    }

};


/**
 * Called either after a successful navigation or on navigation cancelled to reset router's flags states
 *
 * @private
 */
PJaxRouter.prototype._resetRoutingState = function() {
    // reset AJAX calls count
    this._ajaxCalls = 0;
    // we are not loading data anymore
    this._isLoading = false;
    // we are not waiting for a response anymore
    this._transitionsManager.isWaiting = false;
    // reset the transition overriding flag
    this._transitionsManager.isOverriding = false;
};


/*** PUBLIC METHODS ***/

/**
 * In case you want to punctually change the onLeaving duration value, call this in your onStart callback
 *
 * @param newDuration (integer): new duration (in milliseconds) to wait before calling onLeaving this time
 */
PJaxRouter.prototype.overrideTransitionDuration = function(newDuration) {
    this._transitionsManager.isOverriding = true;
    this._transitionsManager.overrideDuration = newDuration || 50;
};

/**
 * Whether the current transition onLeaving callback duration has been overrided or not
 *
 * @returns {boolean}
 */
PJaxRouter.prototype.isTransitionOverrided = function() {
    return this._transitionsManager.isOverriding;
};