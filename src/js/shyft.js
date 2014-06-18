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
            item: 'shyft-item',
            nav: 'shyft-nav',
            navlink: 'shyft-navlink',
            navlink_active: 'shyft-navlink-active',
            prev: 'shyft-prev',
            next: 'shyft-next',
            disabled: 'shyft-disabled'
        }

        /** 
         * Default options
         */
        var _options = {
            // Enable slideshow autoplay
            autoplay: false,
            // Pause slideshow when mouse hovers over carousel
            hoverpause: true,
            // Initial slide to start on (1-indexed)
            offset: null,
            // Delay in milliseconds between items in slideshow mode
            delay: 5000,
            // Allow looping between first and last slides
            loop: true,
            // Enable the previous and next buttons
            prev: true,
            next: true,
            // Custom HTML for previous and next links
            prevhtml: '&lsaquo;',
            nexthtml: '&rsaquo;',
            // Animation to use for various actions
            //   'slide': automatically determines the correct direction to slide 
            //   'slide_l2r': override default direction and force sliding left to right
            //   'slide_r2l': override default direction and force sliding right to left
            //   'fade': cross fade (default)
            prevanim: 'slide',
            nextanim: 'slide',
            changeanim: 'fade',
            // Enable the navigation links
            nav: true,
            // Custom HTML to be used for all navigation links.  If not provided, defaults to the number of the current slide
            //   If you want to use custom HTML and want the slide # you can use {{i}} in your string and it will be replaced with the slide #
            //   e.g. '<span id="slide-{{i}}">This is slide {{i}}</span>'
            navhtml: null,
            // Transition time in milliseconds when changing slides
            transition: 800,
            // Easing function. 'easeOutExpo' is defined in this plugin.  
            // To use other easing functions you must define them manually or include an easing library like the one in jQuery UI
            easing: 'easeOutExpo',
            // Callback functions
            onload: null,
            onprechange: null,
            onpostchange: null,
            onplay: null,
            onpause: null,
            onstart: null,
            onstop: null
        };

        /** 
         * Data object
         */
        var _data = {
            indexes: {},
            interval: null,
            timeout: null
        }

        /** 
         * Element references
         */
        var _elements = {}

        /** 
         * Private variables and methods
         */
        var _private = {

            /** 
             * Initialize the plugin
             * @return obj Returns the _public object
             */
            init: function(obj, options) {
                // Store a reference to the wrapper and add the wrapper class
                _elements.wrapper = obj.addClass(_classes.wrapper);
                // Import custom options to build the _options object
                _private.buildOptions(options);
                // Build the necessary elements
                _private.build();
                // Bind events
                _private.bindEvents();
                // Trigger onload callback
                if(typeof _options.onload == 'function') _options.onload(_data.total, _data.indexes.current);
                // Enable slideshow
                (_options.autoplay) ? _public.start() : _public.stop();
                // Return the public object
                return _public;
            },

            /** 
             * Build the necessary elements based on the given HTML and options
             */
            build: function() {
                // Create arrays for items and navlinks
                // Add null first item.  This will allow all items to be 1-indexed instead of zero-indexed.  
                // Makes more sense for public methods, etc.
                _elements.items = [ null ];
                _elements.navlinks = [ null ];

                // Loop items
                var tmpitems = _elements.wrapper.children();
                _data.total = tmpitems.length;
                tmpitems.each(function() { 
                    // Wrap with item div
                    $(this).wrap('<div class="' + _classes.item + '" />');
                    // Add items to array
                    var item = $(this).parents('.' + _classes.item);
                    _elements.items.push(item);
                });

                // Set the indexes
                var offset = parseInt(_options.offset) || 1;
                var index = (offset > 0 && offset <= _data.total) ? offset : 1;
                _private.updateIndexes(index);

                // Inject the initial slide(s)
                _private.inject(_elements.items[_data.indexes.current], 'fade', true);

                // Create the next and prev links
                if(_options.prev) {
                    _elements.prev = $('<a href="" class="' + _classes.prev + '">' + _options.prevhtml + '</a>').appendTo(_elements.wrapper);
                }
                if(_options.next) {
                    _elements.next = $('<a href="" class="' + _classes.next + '">' + _options.nexthtml + '</a>').appendTo(_elements.wrapper);                
                }

                // Create the nav links
                if(_options.nav) {
                    _elements.nav = $('<div class="' + _classes.nav + '" />').appendTo(_elements.wrapper);
                    for(i=1; i<=_data.total; i++) {
                        var navhtml = (_options.navhtml) ? _options.navhtml.replace('{{i}}', i) : i;
                        var navlink = $('<a href="" class="' + _classes.navlink + '" rel="' + i + '">' + navhtml + '</a>').appendTo(_elements.nav);
                        _elements.navlinks.push(navlink);
                    }
                }

                // Update the buttons
                _private.updateButtons(_data.indexes.current);
            },

            /** 
             * Build the _options object from the various potential sources
             * Make sure they take the appropriate precedence:
             *   default options < options passed into constructor < data-attribute options
             *   data-attribute parameters take the form: data-shyft-<option_name> (no space between 'shyft' and <option_name>)
             * @param (object) The options object passed into the constructor
             */
            buildOptions: function(options) {
                // Override the default options with the options passed in the constructor
                $.extend(_options, options);
                // Override again with options set via data-attributes on the wrapper object
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
                    // Remove the 'shyft' preface and override in the _options object
                    okey = key.replace(/^shyft-/, '');
                    _options[okey] = val;    
                }
            },

            /** 
             * Inject the requested slide and transition to it using the specified transition
             * @param (int) slide: Index (1-based) of the slide to change to
             * @param (str) anim: Animation type to use: 
             *    'slide': slide and automatically determine direction (l2r if new slide is earlier, r2l if later)
             *    'slide_l2r': slide from left to right
             *    'slide_r2l': slide from right to left
             *    'fade': cross fade
             * @param (bool) animateheight: Should the change in height (if there is one) be animated
             */
            inject: function(slide, anim, animateheight) {
                _private.updateHeight(slide, animateheight);
                // Switch based on transition type
                switch(anim) {
                    case 'slide_r2l':
                        _elements.visible.animate({ 'left': '-100%' }, _options.transition, _options.easing, function() {
                            _elements.visible.css({ 'left': '-99999px' });
                        });
                        slide.css({ 'left': '100%' }).animate({ 'left': 0 }, _options.transition, _options.easing, function() {
                            _private.postchange();
                        });
                        break;
                    case 'slide_l2r':
                        _elements.visible.animate({ 'left': '100%' }, _options.transition, _options.easing, function() {
                            _elements.visible.css({ 'left': '-99999px' });
                        });
                        slide.css({ 'left': '-100%' }).animate({ 'left': 0 }, _options.transition, _options.easing, function() {
                            _private.postchange();
                        });                
                        break;
                    default: 
                        // if there are already visible items, fade them out for a crossfade
                        if(_elements.visible) {
                            var old = _elements.visible;
                            old.fadeOut(_options.transition, function() {
                                old.css({ 'left': '-99999px' });
                                old.show();
                            });
                        } 
                        // Fade in the new slide
                        slide.hide().css({ 'left': 0, 'z-index': 5 }).fadeIn(_options.transition, function() {
                            slide.css({ 'z-index': 0 });
                            _private.postchange();
                        });                        
                        break;
                }
            },

            /** 
             * Update the height of the carousel based on the upcoming image
             * @param (int) s: Index (1-based) of the slide to change to
             * @param (bool) skipanimation: Set to true to set height immediately and skip animation
             */
            updateHeight: function(s, skipanimation) {
                var s = s || _data.indexes.current;
                var h = s.outerHeight();
                if(skipanimation) _elements.wrapper.css({ 'height': h });
                else _elements.wrapper.animate({ 'height': h }, 300, _options.animation);
            },

            /** 
             * Update the indexes for current, next and previous, based off the passed index
             * @param (int) x: Index (1-based) to use as the current index and base the next and previous indexes off of
             */
            updateIndexes: function(x) {
                // Index of currently active item
                _data.indexes.old = _data.indexes.current;
                _data.indexes.current = x;
                // Indexes of previous and next items
                _data.indexes.prev = ( (x-1) < 1) ? (x-1) + _data.total : (x-1);
                _data.indexes.next = ( (x+1) > _data.total) ? (x+1) - _data.total : (x+1);
            },

            /** 
             * Update the nav and prev/next buttons based off current slide index and options
             * This sets the active class to the nav item corresponding to the current slide
             * It also disables the prev/next links if _options.loop is false and we are on the first/last slide respectively
             * @param (int) n: Index (1-based) of the current slide
             */
            updateButtons: function(n) {
                // Update the nav links
                if(_options.nav) {
                    _elements.nav.find('.' + _classes.navlink).removeClass(_classes.navlink_active);
                    _elements.navlinks[n].addClass(_classes.navlink_active);
                }

                // Update the prev / next links if necessary
                if(!_options.loop) {
                    // Set default state
                    _data.prevdisabled = false;
                    _elements.prev.removeClass(_classes.disabled);
                    _data.indexes.nextdisabled = false;
                    _elements.next.removeClass(_classes.disabled);
                    // Disable previous if the first item is visible
                    if(n==1) {
                        _data.prevdisabled = true;
                        _elements.prev.addClass(_classes.disabled);
                    }
                    // Disable next if the final item is visible
                    if(n == _data.total) {
                        _data.indexes.nextdisabled = true;
                        _elements.next.addClass(_classes.disabled);
                        _public.stop();
                    }
                }
            },

            /** 
             * Cleanup and other actions to be run after a change has completed
             */
            postchange: function() {
                _elements.visible = _elements.items[_data.indexes.current];
                _data.animating = false;
                if(typeof _options.onpostchange === 'function') _options.onpostchange(_data.indexes.old, _data.indexes.current);            
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
                        var target = $(e.target).closest('.' + _classes.navlink).attr('rel');
                        _public.change(target, _options.changeanim);
                    });
                }
                // Bind pause on hover
                if(_options.hoverpause) {
                    _elements.wrapper.on({
                        mouseenter: function() { _public.pause(); },
                        mouseleave: function() { _public.play(); }
                    });
                }
                // Bind resize
                $(window).on('resize', function() {
                    _private.updateHeight(_elements.visible, true);
                });
            },

        }


        /** 
         * Public object
         * The public object is returned by the constructor and exposes public methods
         */
        var _public = {

            /** 
             * Change slide
             * @param (mixed) newindex: Defines which slide to change to
             *   (str) '+': Changes to the next slide
             *   (str) '-': Changes to the previous slide
             *   (int)    : Changes to the index (1-based) defined by the integer
             * @param (bool) (optional) nostop: Pass boolean true to prevent the change from triggering the stop() action
             * @param (str) (optional) anim: Animation type to use for the change
             */
            change: function(newindex, anim, nostop) {
                if(!nostop) _public.stop();
                if(_data.animating) return false;
                _data.animating = true;
                if(newindex == _data.indexes.current) return false;
                // If the animation is 'slide', determine the correct direction to slide
                if(anim == 'slide') {
                    anim = (newindex > _data.indexes.current || newindex == '+') ? 'slide_r2l' : 'slide_l2r';
                }
                // Switch slides based on the type of change
                switch(newindex) {
                    case '+':
                        if(_data.indexes.nextdisabled) return false;
                        newindex = _data.indexes.next;
                        break;
                    case '-':
                        if(_data.prevdisabled) return false;
                        newindex = _data.indexes.prev;
                        break;
                    default: 
                        newindex = parseInt(newindex);
                        break;
                }

                anim = anim || _options.changeanim;
                if(typeof _options.onprechange === 'function') _options.onprechange(_data.indexes.current, newindex);
                _private.inject(_elements.items[newindex], anim);
                _private.updateButtons(newindex);
                _private.updateIndexes(newindex);
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