function PJaxRouter(params) {
    // init the router object
    this.router = {
        isLoading: false,
        history: [{
            href: window.location.href,
            title: document.title,
        }],
        ajaxCalls: 0,
    };

    this._mutations = {
        countMutations: 0,
        mutationObserver: null,
        isActive: false,
    };

    // init params
    this._initParams(params);

    // init events
    this._initEvents();
}


PJaxRouter.prototype._initParams = function(params) {

    // default params
    this.params = {
        container: document.body,
        cancelNavigationClass: null,

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
        onAfter: {
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

};


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
            self._launchAjaxNavigation(window.location.href, false);
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

        // check if this is a link to the exact same page
        if(window.location.pathname === href || window.location.href === href) {
            e.preventDefault();
            e.stopPropagation();

            return false;
        }

        e.preventDefault();
        e.stopPropagation();

        self._launchAjaxNavigation(href, true);
    });

    // mutation observer
    if(!!window.MutationObserver) {
        this._mutations.isActive = true;

        this._mutations.mutationObserver = new MutationObserver(function(mutations, observer){
            if( mutations[0].addedNodes.length || mutations[0].removedNodes.length )
                self._observedMutation(mutations);
        });
    }
};


/*** ROUTING ***/


PJaxRouter.prototype._launchAjaxNavigation = function(href, shouldUpdateHistory) {
    if(!this.router.isLoading) {
        this._routing(href, shouldUpdateHistory);

        // on before
        this.params.onStart.value();

        var self = this;
        setTimeout(function() {

            self.params.onLeaving.value();

            if(self.router.nextHTMLContent) {
                self._appendDatas(shouldUpdateHistory);
            }
            else {
                self._waitForDatas(shouldUpdateHistory);
            }

        }, self.params.onLeaving.duration);
    }
};


PJaxRouter.prototype._waitForDatas = function(shouldUpdateHistory) {
    var self = this;
    var datasInterval = setInterval(function() {
        if(self.router.nextHTMLContent) {
            clearInterval(datasInterval);
            self._appendDatas(shouldUpdateHistory);
        }
    }, 1000);

};

PJaxRouter.prototype._observedMutation = function(mutations) {
    for(var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];

        // count that as a useful mutation only if a non text node is added
        if(mutation.addedNodes.length > 0) {
            this._mutations.countMutations++;
        }
    }

    //if(this._mutations.countMutations === this._mutations.mutationNumbers) {
    if(this._mutations.countMutations === 1) {
        this._mutations.mutationObserver.disconnect();

        var self = this;
        setTimeout(function() {
            self._newContentAdded();
        }, 34); // wait for a couple tick just to be sure
    }
};


PJaxRouter.prototype._newContentAdded = function() {
    var self = this;
    setTimeout(function() {
        self.params.onReady.value();
    }, 0);

    setTimeout(function() {
        // onAfter
        self.router.isLoading = false;

        self.params.onAfter.value();

    }, self.params.onAfter.duration);
};


PJaxRouter.prototype._appendDatas = function(shouldUpdateHistory) {

    var pageTitle = this.router.nextHTMLContent.match(/<title[^>]*>([^<]+)<\/title>/)[1];

    // handle history with pushState
    if(shouldUpdateHistory) {
        window.history.pushState(this.router, pageTitle, this.router.nextHref);
    }
    document.title = pageTitle;

    // keep trace of navigation inside our router
    this.router.history.push({
        href: this.router.nextHref,
        title: pageTitle
    });

    // append our response to a div
    var tempHtml = document.createElement('div');
    tempHtml.insertAdjacentHTML("beforeend", this.router.nextHTMLContent);

    var content = tempHtml.querySelector("#" + this.params.container.getAttribute("id"));
    tempHtml = null;

    var self = this;

    if(content && content.children && content.children.length > 0) {
        if(this._mutations.isActive) {
            this._mutations.countMutations = 0;

            this._mutations.mutationObserver.observe(this.params.container, {
                childList: true,
            });
        }
        else {
            setTimeout(function() {
                self._newContentAdded();
            }, content.children.length * 25);
        }


        // empty our content div and append our new content
        this.params.container.innerHTML = "";

        var tempContent = document.createDocumentFragment();
        while(content.hasChildNodes()) {
            tempContent.appendChild(content.firstChild);
        }
        this.params.container.appendChild(tempContent);
    }

};


PJaxRouter.prototype._routing = function(href, shouldUpdateHistory) {
    // init our routing
    this.router.isLoading = true;
    this.router.nextHref = null;

    // set next href
    if(href) {
        this.router.nextHref = href;
    }
    else if(this.router.history.length > 0) {
        this.router.nextHref = this.router.history[this.router.history.length - 1].href;
    }

    // empty the old datas
    this.router.nextHTMLContent = null;

    if(this.router.nextHref) {
        // handling ajax
        var xhr = new XMLHttpRequest();

        var self = this;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
                self.router.nextHTMLContent = xhr.response;
            }
            else if(xhr.readyState === 4 && xhr.status !== 404 && self.router.ajaxCalls < 4) {
                if(self.router.ajaxCall === 0) {
                    self.params.onWaiting.value();
                }

                self.router.ajaxCalls++;
                self._routing(href, shouldUpdateHistory);
            }
            else if(xhr.readyState === 4) {
                self.router.ajaxCalls = 0;
                self.router.isLoading = false;

                self.params.onError.value();
            }
        };

        xhr.open("GET", href, true);
        xhr.setRequestHeader("Accept", "text/html");
        xhr.send(null);
    }
};