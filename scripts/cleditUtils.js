;(function (cledit) {
  var Utils = {
    isGecko: 'MozAppearance' in document.documentElement.style,
    isWebkit: 'WebkitAppearance' in document.documentElement.style,
    isMsie: 'msTransform' in document.documentElement.style,
    isMac: navigator.userAgent.indexOf('Mac OS X') !== -1
  }

  // Faster than setTimeout(0). Credit: http://dbaron.org/log/20100309-faster-timeouts
  Utils.defer = (function () {
    var timeouts = []
    var messageName = 'deferMsg'
    window.addEventListener('message', function (evt) {
      if (evt.source === window && evt.data === messageName) {
        evt.stopPropagation()
        if (timeouts.length > 0) {
          try {
            timeouts.shift()()
          } catch (e) {
            window.console.error(e.message, e.stack)
          }
        }
      }
    }, true)
    return function (fn) {
      timeouts.push(fn)
      window.postMessage(messageName, '*')
    }
  })()

  Utils.debounce = function (func, wait) {
    var timeoutId, isExpected
    return wait
      ? function () {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(func, wait)
      }
      : function () {
        if (!isExpected) {
          isExpected = true
          Utils.defer(function () {
            isExpected = false
            func()
          })
        }
      }
  }

  Utils.createEventHooks = function (object) {
    var listenerMap = {}
    object.$trigger = function (eventType) {
      var listeners = listenerMap[eventType]
      if (listeners) {
        var args = Array.prototype.slice.call(arguments, 1)
        listeners.cl_each(function (listener) {
          try {
            listener.apply(object, args)
          } catch (e) {
            window.console.error(e.message, e.stack)
          }
        })
      }
    }
    object.on = function (eventType, listener) {
      var listeners = listenerMap[eventType]
      if (!listeners) {
        listeners = []
        listenerMap[eventType] = listeners
      }
      listeners.push(listener)
    }
    object.off = function (eventType, listener) {
      var listeners = listenerMap[eventType]
      if (listeners) {
        var index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  Utils.findContainer = function (elt, offset) {
    var containerOffset = 0
    var container
    do {
      container = elt
      elt = elt.firstChild
      if (elt) {
        do {
          var len = elt.textContent.length
          if (containerOffset <= offset && containerOffset + len > offset) {
            break
          }
          containerOffset += len
        } while ((elt = elt.nextSibling))
      }
    } while (elt && elt.firstChild && elt.nodeType !== 3)

    if (elt) {
      return {
        container: elt,
        offsetInContainer: offset - containerOffset
      }
    }
    while (container.lastChild) {
      container = container.lastChild
    }
    return {
      container: container,
      offsetInContainer: container.nodeType === 3 ? container.textContent.length : 0
    }
  }

  cledit.Utils = Utils
})(window.cledit)
