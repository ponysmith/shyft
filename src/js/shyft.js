/** 
 * shyft.js
 * Javascript content carousel
 * @author Pony Smith (pony@ponysmith.com)
 */

// Using UMD to make the plugin AMD compliant for use w/ RequireJS
// based on https://github.com/umdjs/umd
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], function (jQuery) {
            return (root.shyft = factory(jQuery));
        });
    } else {
        root.shyft = factory(root.jQuery);
    }
}(this, function ($) {

    /** 
     * @param (jQuery obj) jQuery object for the carousel wrapping element
     * @param (object) Optional options object
     */
    return function(obj, options) {
        /** 
         * Define the easeOutExpo easing function for jQuery.  This is the default easing function that will be used
         * If you want to use a different easing function via the 'easing' option, you must make sure it is defined in jQuery
         */
        $.easing.easeOutExpo = function (x, t, b, c, d) { return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b; }

        /** 
         * CSS Classes
         */
        var _classes = {
            wrapper: 'shyft-wrapper',
            fadewrapper: 'shyft-fade-wrapper',
            canvas: 'shyft-canvas',
            clone: 'shyft-clone',
            item: 'shyft-item',
            nav: 'shyft-nav',
            navlink: 'shyft-navlink',
            navlink_active: 'shyft-navlink-active',
            navlink_active_secondary: 'shyft-navlink-active-secondary',
            prev: 'shyft-prev',
            next: 'shyft-next',
            disabled: 'shyft-disabled'
        }

        /** 
         * Default options
         */
        var _options = {
            // Number of slides to show
            numtoshow: 1,
            // Number of slides to scroll on next/prev
            numtoscroll: 1,
            // Initial slide to start on (1-indexed)
            offset: null,
            // Enable slideshow autoplay
            autoplay: false,
            // Delay in milliseconds between items in slideshow mode
            delay: 5000,
            // Transition time in milliseconds when changing slides
            transition: 800,
            // Pause slideshow when mouse hovers over carousel
            hoverpause: true,
            // Allow looping between first and last slides
            loop: true,
            // Enable the previous and next buttons
            prev: true,
            next: true,
            // Custom HTML for previous and next links
            prevhtml: '&lsaquo;',
            nexthtml: '&rsaquo;',
            // Enable the navigation links
            nav: true,
            // Animation to use for various actions
            //   'slide': (default) slides left or right depending on relationship of slides
            //   'fade': fade 
            //   'instant': changes to the new slide with no transition
            prevanim: 'slide',
            nextanim: 'slide',
            changeanim: 'fade',
            // Custom HTML to be used for all navigation links.  If not provided, defaults to the number of the current slide
            //   If you want to use custom HTML and want the slide # you can use {{i}} in your string and it will be replaced with the slide #
            //   e.g. '<span id="slide-{{i}}">This is slide {{i}}</span>'
            navhtml: null,
            // Easing function. 'easeOutExpo' is defined in this plugin.  
            // To use other easing functions you must define them manually or include an easing library like the one in jQuery UI
            easing: 'easeOutExpo',
            // Callback functions
            onload: null,
            onupdate: null,
            ondestroy: null,
            onprechange: null,
            onpostchange: null,
            onadd: null,
            onremove: null,
            onplay: null,
            onpause: null,
            onstart: null,
            onstop: null
        };

        /** 
         * Data object
         */
        var _data = {}

        /** 
         * Element references
         */
        var _elements = {}

        /** 
         * Private methods
         */
        var _private = {

            /** 
             * Initialize the plugin
             * @return obj Returns the _public object
             */
            init: function(obj, options) {
                // Store a reference to the wrapper and add the wrapper class
                _elements.wrapper = obj;
                // Build options from any data- attributes
                dataoptions = _private.buildOptions(options);
                // Build the final options object
                $.extend(_options, options, dataoptions);
                // Build the necessary elements
                _private.build();
                // Return the public object
                return _public;
            },

            /** 
             * Build the necessary elements based on the given HTML and options
             * @param (bool) isupdate: This will be true if build() was called as part of update(), otherwise, false
             */
            build: function(isupdate) {
                // Add the wrapper class
                _elements.wrapper.addClass(_classes.wrapper);
                // Setup items
                _data.indexes = {};
                _data.itemwidth = _elements.wrapper.width() / _options.numtoshow;
                _elements.items = _elements.wrapper.children().wrap('<div>').parent().addClass(_classes.item);
                _elements.fadewrapper = $('<div>').addClass(_classes.fadewrapper);
                _data.total = _elements.items.length;
                // Set min and max indexes if looping is disabled
                _data.indexes.min = 1;
                _data.indexes.max = _data.total - (_options.numtoshow - 1);
                // Create canvases
                _elements.canvas = _elements.wrapper.children().wrapAll('<div>').parent().addClass(_classes.canvas);
                // Set the index
                var offset = parseInt(_options.offset) || 1;
                _data.indexes.current = (offset < 1 || offset > _data.total) ? 1 : offset;
                // Build clone sections
                _private.buildClones();
                // Set item width
                _private.updateWidths();
                // Build the UI elements
                _private.buildUI();
                // Update buttons
                _private.updateButtons();
                // Bind events
                _private.bindEvents();
                // Trigger the appropriate callback
                if(typeof _options.onload == 'function' && !isupdate) _options.onload(_data.total, _data.indexes.current);
                if(typeof _options.onupdate == 'function' && isupdate) _options.onupdate(_data.total, _data.indexes.current);
                // Set initial position
                _private.transition('instant');
                // Enable slideshow
                (_options.autoplay) ? _public.start() : _public.stop();
            },

            /** 
             * Build the _options object from the various potential sources
             * Make sure they take the appropriate precedence:
             *   default options < options passed into constructor < data-attribute options
             *   data-attribute parameters take the form: data-shyft-<option_name> (no space between 'shyft' and <option_name>)
             * @param (object) The options object passed into the constructor
             */
            buildOptions: function(options) {
                var o = {};
                var data = _elements.wrapper.data();
                for(var key in data) {
                    // Cast the values appropriately
                    var val = data[key];
                    switch(true) {
                        case (val.toString().toLowerCase() === 'true'): val = true; break;
                        case (val.toString().toLowerCase() === 'false'): val = false; break;
                        case (!isNaN(parseFloat(val)) && isFinite(val)): val = Number(val); break;
                        default: val = val.toString(); break;
                    }
                    // Remove the 'shyft' preface
                    okey = key.toLowerCase().replace(/^shyft/, '');
                    o[okey] = val;    
                }
                return o;
            },

            /** 
             * Build UI elements
             */
            buildUI: function() {
                // Create the next and prev links
                if(_options.prev) _elements.prev = $('<a>').addClass(_classes.prev).html(_options.prevhtml).appendTo(_elements.wrapper);
                if(_options.next) _elements.next = $('<a>').addClass(_classes.next).html(_options.nexthtml).appendTo(_elements.wrapper);
                // Create the nav links
                if(_options.nav) {
                    _elements.nav = $('<div>').addClass(_classes.nav).appendTo(_elements.wrapper);
                    for(i=1; i<=_data.total; i++) {
                        var navhtml = (_options.navhtml) ? _options.navhtml.replace(/{{i}}/g, i) : i;
                        var navlink = $('<a>').addClass(_classes.navlink).attr('rel',i).html(navhtml).appendTo(_elements.nav);
                    }
                    _elements.navlinks = _elements.nav.find('.' + _classes.navlink);
                }
            },

            /** 
             * Build the necessary clones to add before and after the core items
             * This will allow us to slide beyond the end of the set without blank space
             */
            buildClones: function() {
                // Set the number of clones to create on each end
                _data.numclones = _options.numtoscroll + 1;
                _data.clonewidth = (_data.itemwidth * _data.numclones);
                // Create pre clones
                _elements.items.clone().slice(_data.total - _data.numclones, _data.total).addClass(_classes.clone).prependTo(_elements.canvas);
                // Create post clones
                _elements.items.clone().slice(0, _data.numclones).addClass(_classes.clone).appendTo(_elements.canvas);
                // Capture the clones
                _elements.clones = _elements.wrapper.find('.' + _classes.clone);
            },

            /** 
             * Validate and convert a change delta to a proper index
             * This needs to take into account _options.loop
             * @param (mixed) delta: Change delta to calculate the index from 
             * @return (int): Returns an index (1-based).  Numbers below 1 and greater than _data.total correnspond to clone indexes
             */
            setIndexes: function(delta) {
                _data.indexes.old = _data.indexes.current;
                switch(delta) {
                    case '+':
                        var i = _data.indexes.current + _options.numtoscroll;
                        if(!_options.loop && i > _data.indexes.max) i = _data.indexes.max;
                        break;
                    case '-':
                        var i = _data.indexes.current - _options.numtoscroll;
                        if(!_options.loop && i < _data.indexes.min) i = _data.indexes.min;
                        break;
                    default: 
                        var i = parseInt(delta);
                        if(!_options.loop && i > _data.indexes.max) i = _data.indexes.max;
                        break;
                }
                _data.indexes.current = i;
            },

            /** 
             * Set the item width
             */
            updateWidths: function() {
                _data.itemwidth = _elements.wrapper.width() / _options.numtoshow;
                _data.clonewidth = _data.itemwidth * _data.numclones;
                _data.canvaswidth = (2 * _data.numclones + _data.total) * _data.itemwidth;
                _elements.items.css({ 'width': _data.itemwidth });
                _elements.clones.css({ 'width': _data.itemwidth });
                _elements.canvas.css({ 'width': _data.convaswidth });
                _private.transition('instant');
            },

            /** 
             * Update the nav and prev/next buttons based off current slide index and options
             * This sets the active class to the nav item corresponding to the current slide
             * It also disables the prev/next links if _options.loop is false and we are on the first/last slide respectively
             */
            updateButtons: function() {
                // Update the nav links
                if(_options.nav) {
                    _elements.navlinks.removeClass(_classes.navlink_active).removeClass(_classes.navlink_active_secondary);
                    var idx = _data.indexes.current - 1;
                    for(i=0; i<_options.numtoshow; i++) {
                        if(idx >= _data.total) idx = 0;
                        (i == 0) 
                            ? _elements.navlinks.eq(idx).addClass(_classes.navlink_active)
                            : _elements.navlinks.eq(idx).addClass(_classes.navlink_active_secondary);
                        idx++;
                    }
                }
                // Update the prev / next links if necessary
                if(!_options.loop) {
                    // Prev
                    if(_options.prev) {
                        _data.prevdisabled = false;
                        _elements.prev.removeClass(_classes.disabled);
                        // Disable previous if the first item is visible
                        if(_data.indexes.current == _data.indexes.min) {
                            _data.prevdisabled = true;
                            _elements.prev.addClass(_classes.disabled);
                        }
                    }
                    // Next
                    if(_options.next) {
                        _data.nextdisabled = false;
                        _elements.next.removeClass(_classes.disabled);
                        // Disable next if the final item is visible
                        if(_data.indexes.current == _data.indexes.max) {
                            _data.indexes.current.nextdisabled = true;
                            _elements.next.addClass(_classes.disabled);
                            _public.stop();
                        }
                    }
                }
            },

            /**
             * Prechange setup
             * @param (mixed) delta: The change delta for the currently processing change ('+', '-', or int)
             */
            prechange: function(delta) {
                // Get a valid index for the change
                _private.setIndexes(delta);
                // Update buttons
                _private.updateButtons();
                // If the new index is a clone index, reset the initial location so that the transition starts on clones and ends on real elements
                // Then call setIndexes again to get the newindex based on the updated position
                if(_data.indexes.current < 1) {
                    _data.indexes.current = _data.indexes.old + _data.total;  
                    _private.transition('instant');
                    _private.setIndexes(delta);
                }
                if(_data.indexes.current > _data.total) {  
                    _data.indexes.current = _data.indexes.old - _data.total;  
                    _private.transition('instant');
                    _private.setIndexes(delta);
                }
                if(typeof _options.onprechange == 'function') _options.onprechange(_data.indexes.old, _data.indexes.current);
            },

            /** 
             * Cleanup and other actions to be run after a change has completed
             */
            postchange: function() {
                // If we are on the final slide of autoplay and looping is disabled, stop()
                if(!_options.loop && _data.indexes.current > _data.indexes.max) _public.stop();
                // Remove the fade wrapper
                _elements.fadewrapper.empty().remove();
                // Trigger the callback
                if(typeof _options.onpostchange == 'function') _options.onpostchange(_data.indexes.old, _data.indexes.current);
                // Turn off the changing flag
                _data.changing = false;
            },
    
            /**
             * Transition to a new slideset
             * @param (str) anim: The animation to use
             */
            transition: function(anim) {
                // Set the left offset
                var left = (0 - (_data.clonewidth + (_data.itemwidth * (_data.indexes.current-1))));
                switch(anim) {
                    case 'instant':
                        _elements.canvas.css({ 'left': left });
                        _private.postchange();
                        break;
                    case 'fade':
                        var idx = _data.indexes.current;
                        for(i=0; i<_options.numtoshow; i++) {
                            if(idx > _data.total) idx = 1;
                            _elements.items.eq(idx-1).clone().appendTo(_elements.fadewrapper);
                            idx++;
                        }
                        _elements.fadewrapper.hide().prependTo(_elements.wrapper).fadeIn(_options.transition, function() {
                            _private.transition('instant');
                        });
                        break;
                    default: 
                        _elements.canvas.animate({ 'left': left }, _options.transition, _private.postchange);
                        break;
                }
            },

            /** 
             * Bind events to the various elements in the carousel
             * Events will not be bound if their respective options are not enabled
             */
            bindEvents: function() {
                // Bind prev / next links
                if(_options.prev) {
                    _elements.prev.on('click', function(e) {
                        e.preventDefault();
                        _public.change('-', _options.prevanim);
                    });
                }
                if(_options.next) {
                    _elements.next.on('click', function(e) {
                        e.preventDefault();
                        _public.change('+', _options.nextanim);
                    });
                }
                // Bind nav links
                if(_options.nav) {
                    _elements.nav.on('click', '.' + _classes.navlink, function(e) {
                        e.preventDefault();
                        var delta = $(e.target).closest('.' + _classes.navlink).attr('rel');
                        _public.change(delta, _options.changeanim);
                    });
                }
                // Bind pause on hover
                if(_options.hoverpause) {
                    _elements.wrapper.on({
                        mouseenter: function() { _public.pause(); },
                        mouseleave: function() { _public.play(); }
                    });
                }
                // Resize item widths on resize
                $(window).on('resize', _private.updateWidths);
            },

        }


        /** 
         * Public object returned by the constructor to expose public methods
         */
        var _public = {

            /** 
             * Destroy the carousel
             * @param (bool) nocallback: Set to true to prevent ondestroy callback from firing - useful for internal use of destroy() as in update()
             */
            destroy: function(nocallback) {
                // Remove elements
                _elements.prev.remove();
                _elements.next.remove();
                _elements.nav.remove();
                _elements.clones.remove();
                if(_data.total > 0) _elements.items.unwrap('.' + _classes.canvas);
                else _elements.canvas.remove();
                // Remove wrappers and classes
                _elements.items.children().unwrap('.' + _classes.item);
                _elements.wrapper.removeClass('shyft-wrapper');
                // Disable the autoplay interval
                clearInterval(_data.interval);
                // Fire the callback
                if(typeof _options.ondestroy == 'function' && !nocallback) _options.ondestroy();
            },

            /** 
             * Update the carousel with new options
             */
            update: function(options) {
                // Set the offset to current slide to maintain state unless overridden with the new options
                _options.offset = _data.indexes.current;
                // Extend the options if new options were passed
                if(typeof options != null) $.extend(_options, options);
                // Destroy and rebuild the carousel
                _public.destroy(true);
                _private.build(true);
            },

            /** 
             * Add a slide
             * @param (jQuery) slide: jQuery object representing the slide content
             * @param (int) index: 1-based index corresponding to the position to add the new slide
             * @param (bool) focus: set true to automatically focus the new slide
             */
            add: function(slide, index, focus) {
                // Add the slide to the appropriate position
                (!isNaN(parseFloat(index)) && isFinite(index) && index > 0 && index <= _data.total) 
                    ? _elements.items.eq(index - 1).before(slide)
                    : _elements.wrapper.append(slide);
                // Fire the add callback
                if(typeof _options.onadd == 'function') _options.onadd(slide);
                // Set the slide to focus and refresh the carousel
                var idx = (focus) ? index : _data.indexes.current;
                _public.update({ offset: idx });
            },

            /** 
             * Remove a slide
             * @param (int) index: 1-based index of the slide to remove
             */
            remove: function(index) {
                index = index || _data.indexes.current;
                // Remove the selected slide and capture a reference to it (unwrapped)
                var item = _elements.items.eq(index - 1).remove().children().unwrap('.' + _classes.item);
                // Fire the callback
                if(typeof _options.onremove === 'function') _options.onremove(item);
                // Make sure the current slide persists when the carousel is rebuilt
                opts = (index > _data.indexes.current)
                    ? { offset: _data.indexes.current }
                    : { offset: _data.indexes.current - 1};
                // Only refresh if there will still be at least one item, otherwise destroy
                _data.total--;
                if(_data.total > 0) _public.update(opts);
                else _public.destroy();
            },

            /** 
             * Change slide
             * @param (mixed) delta: Defines which slide to change to
             *   (str) '+': Changes to the next slide
             *   (str) '-': Changes to the previous slide
             *   (int)    : Changes to the index (1-based) defined by the integer
             * @param (str) (optional) anim: Animation type to use for the change
             * @param (bool) (optional) nostop: Pass boolean true to prevent the change from triggering the stop() action
             */
            change: function(delta, anim, nostop) {
                // Don't allow two change events at once
                if(_data.changing) return false;
                _data.changing = true;
                // Set a default animation
                anim = anim || _options.changeanim;
                // Trigger stop if nostop is not true
                if(!nostop) _public.stop();
                // Handle any pre-change setup
                _private.prechange(delta);
                // If the updated index is the same as the current, no need to go any further
                if(_data.indexes.old == _data.indexes.current) return;
                // Transition
                _private.transition(anim);
            },

            /** 
             * Sets the slideshow status to 'play'
             * This function will only work if the current status is 'pause'.  If the slideshow status is 'stop', start() must be used instead
             */
            play: function() {
                if(_data.status == 'stop' || _data.status == 'play') return false;
                _data.status = 'play';
                _data.interval = setInterval(function() {
                    _public.change('+', _options.nextanim, true);
                }, _options.delay);
                if(typeof _options.onplay === 'function') _options.onplay();
            }, 

            /** 
             * Sets the slideshow status to 'pause'
             * This function will not work if the slideshow status is 'stop'
             */
            pause: function() {                
                if(_data.status == 'stop' || _data.status == 'pause') return false;
                _data.status = 'pause';
                clearInterval(_data.interval);
                if(typeof _options.onpause === 'function') _options.onpause();
            },

            /** 
             * Sets the slideshow status to 'start' and then to 'play' via the play() method.
             * If the slideshow status is 'stop', this is the only way to start it
             */
            start: function() {
                if(_data.status == 'play') return false;
                _data.status = 'start';
                if(typeof _options.onstart === 'function') _options.onstart();
                _public.play();
            },

            /** 
             * Sets the slideshow status to 'stop'
             * Stopping the slideshow will prevent any play or pause actions from having an effect, unless start() is called first
             */
            stop: function() {
                if(_data.status == 'stop') return false;
                _data.status = 'stop';
                clearInterval(_data.interval);
                if(typeof _options.onstop === 'function') _options.onstop();
            }
        }

        // Initiate the plugin with options
        // This will return an object of public methods to the script that originally called the plugin
        return _private.init(obj, options);
    }

}));