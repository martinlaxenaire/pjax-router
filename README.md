Really simple PJAX Router

<h2>Installation</h2>
    
```html
<script src="pjax.router.min.js"></script>
```

<h2>Initializing</h2>

```javascript
var router = new PJaxRouter();
```

<h3>Basic parameters</h3>

There are 2 basic parameters that you can specify:

| Parameter  | Type | Default | Description |
| --- | --- | --- | --- |
| container  | HTML node | document.body | The container inside which the content will be replaced after each AJAX calls |
| cancelNavigationClass | String | "" | A class to apply to link that should not trigger AJAX navigation |

```javascript
var router = new PJaxRouter({
    container: document.getElementById("content"), // container where datas will be removed/appended
    cancelNavigationClass: "out" // links with that class does not trigger PJAX navigation
});
```

<h3>Callbacks</h3>

| Name | Duration | Value|  Description |
| --- | --- | --- | --- |
| onStart  | not used | Function | Called as soon as a link has been clicked and navigation starts |
| onLeaving | default to 1000ms | Function | Called 1000ms after onStart, just before new data should be appended |
| onReady | not used | Function | Called as soon as the new data have been appended |
| onAfter | default to 1000ms | Function | Called 1000ms after onReady |
| onWaiting | not used | Function | Called if data are not yet ready but the duration of onLeaving has been spent |
| onError | not used | Function | Called if there has been an error while trying to retrieve the data |

```javascript
var router = new PJaxRouter({
    container: document.getElementById("content"), // container where datas will be striped/appended
    cancelNavigationClass: "out" // links with that class does not trigger PJAX navigation
    
    onStart: {
        value: function() {
            console.log("navigation has started, do your hiding animations and stuff");
        },
    },
    onLeaving: {
        duration: 1250,
        value: function() {
            console.log("1.25s has been ellapsed since navigation started, time to remove event listeners and stuff before the content will be removed");
        },
    },
    onReady: {
        value: function() {
            console.log("new data have been successfully appended, do you showing animations and register your new event listeners");
        },
    },
    onAfter: {
        duration: 1250,
        value: function() {
            console.log("1.25s has been ellapsed since the new data have been appended, do whatever you need here");
        },
    },
    onWaiting: {
        value: function() {
            console.log("data are late... maybe you could display a loader?");
        },
    },
    onError: {
        value: function() {
            console.log("there has been an error while trying to retrieve the data and the navigation has been cancelled");
        },
    },
});
```