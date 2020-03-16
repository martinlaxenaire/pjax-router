Really simple PJAX Router

<h2>Installation</h2>
    
```html
<script src="pjax.router.min.js"></script>
```

<h2>Initializing</h2>

```javascript
var router = new PJaxRouter();
```

<h3>Parameters</h3>

<h4>Basic params</h4>

There are 5 basic parameters that you can specify:

| Parameter  | Type | Default | Description |
| --- | --- | --- | --- |
| container  | HTML node | document.body | The container inside which the content will be replaced after each AJAX calls |
| cancelNavigationClass | String | "" | A class to apply to link that should not trigger AJAX navigation |
| cacheLinks | CSS Selector | "" | A CSS selector to match links on the page you'd like to cache on init and after each successful navigation |
| cacheNavigatedPages | Boolean | false | Whether to cache the page where you just navigated (including first page loaded) |
| cacheLength | Number | 10 | Maximum number of cached pages |

```javascript
var router = new PJaxRouter({
    container: document.getElementById("content"), // container where datas will be removed/appended
    cancelNavigationClass: "out", // links with that class does not trigger PJAX navigation
    cacheLinks: ".important-pages", // cache pages for all the links that have the ".important-pages" class on init and after each successful navigation
    cacheNavigatedPages: true, // add the current page to the cache after each successful navigation
    cacheLength: 15, // set the cache size to 15 entries
});
```

<h4>Routing callbacks</h3>

| Name | Duration | Value |  Description |
| --- | --- | --- | --- |
| onStart  | not used | function(currentPage, nextPage) | Called as soon as a link has been clicked and navigation starts |
| onLeaving | default to 1000ms | function(currentPage, nextPage) | Called 1000ms after onStart, just before new data should be appended |
| onReady | not used | function(prevPage, currentPage) | Called as soon as the new data have been appended |
| onWaiting | not used | function(currentPage, nextPage) | Called if data are not yet ready but the duration of onLeaving has been spent |
| onError | not used | function(currentPage, nextPage) | Called if there has been an error while trying to retrieve the data |

```javascript
var router = new PJaxRouter({
    container: document.getElementById("content"), // container where datas will be striped/appended
    cancelNavigationClass: "out", // links with that class does not trigger PJAX navigation
    cacheLinks: ".important-pages", // cache pages for all the links that have the ".important-pages" class on init and after each successful navigation
    cacheNavigatedPages: true, // add the current page to the cache after each successful navigation
    cacheLength: 15, // set the cache size to 15 entries
    
    onStart: {
        value: function(currentPage, nextPage) {
            console.log("navigation has started, do your hiding animations and stuff. Going from/to:", currentPage, nextPage);
        },
    },
    onLeaving: {
        duration: 1250,
        value: function(currentPage, nextPage) {
            console.log("1.25s has been ellapsed since navigation started, time to remove event listeners and stuff before the content will be removed. Going from/to:", currentPage, nextPage);
        },
    },
    onWaiting: {
        value: function(currentPage, nextPage) {
            console.log("data are late... maybe you could display a loader?. Going from/to:", currentPage, nextPage);
        },
    },
    onError: {
        value: function(currentPage, nextPage) {
            console.log("there has been an error while trying to retrieve the data and the navigation has been cancelled. Going from/to:", currentPage, nextPage);
        },
    },
    onReady: {
        value: function(prevPage, currentPage) {
            console.log("new data have been successfully appended, do you showing animations and register your new event listeners. Successful transition from/to:", prevPage, currentPage);
        },
    },
});
```

<h3>Router object</h3>

The `router` object returned is a PJAXRouter object with the following useful properties and methods:

<h4>Properties</h4>

| Property  | Type | Description |
| --- | --- | --- |
| container | HTML element | HTML element container where data will be appended |
| lastLinkClicked | HTML <a> element | last link element clicked that triggered an AJAX navigation |
| router | object | an object containing an history of your navigation among others |

<h4>Methods</h4>

| Method | Parameters | Return value | Description |
| --- | --- | --- | --- |
| overrideTransitionDuration | newDuration (in milliseconds) | void | If you want to override onLeaving default duration once, call this in your onStart callback with the new duration desired |
| isTransitionOverrided | - | boolean | Returns true if onLeaving duration is actually being overrided, false otherwise |