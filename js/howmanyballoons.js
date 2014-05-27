var hmb = (function($, Handlebars) {
    var module = {};

    /** Returns a compiled handlebars template */
    var get_template = function(selector) {
        return Handlebars.compile($(selector).html());
    };

    /** Make results section visibke and start slideshow */
    var show_results_section = function() {
        $("#results-section").css("visibility", "visible");
    };

    /** Add a percentage sign to a number */
    var percentify = function(number) {
        return String(number) + "%";
    };

    /** Spin a div from one angle to another */
    var spin_div = function($div, from, to, duration, complete) {
        $({deg: from}).animate({deg: to}, {
            duration: duration,
            step: function(now) {
                $div.css({
                    transform: "rotate(" + now + "deg)"
                });
            },
            complete: complete
        });
    };

    /** Swing a div back and forth */
    var swing_div = function($div, from, to, duration) {
        spin_div($div, from, to, duration, function() {
            spin_div($div, to, from, duration, function() {
                swing_div($div, from, to, duration);
            });
        });
    };

    var Balloon = (function() {
        // Lift per metre cubed of helium
        var LIFT_PER_M3 = 1.1;

        var cls = function(radius) {
            this.vol = (4.0 / 3.0) * Math.PI * Math.pow(radius, 3);
        };
        cls.prototype = {};

        /** Number of balloons required to lift an object with given mass */
        cls.prototype.num_balloons = function(mass) {
            var total_vol = mass / LIFT_PER_M3;
            return Math.ceil(total_vol / this.vol);
        };

        /**
         * Minimum radius of a lattice of given number of balloons
         * This uses maximum average density for a regular sphere lattice of pi / 3 * sqrt(2)
         */
        cls.prototype.lattice_radius = function(num_balloons) {
            var radius_cubed = (9.0 / 4.0) * Math.sqrt(2) * this.vol * num_balloons;
            return Math.pow(radius_cubed, (1.0 / 3.0));
        };
        return cls;
    }());

    var standard_balloon = new Balloon(0.129);
    // Based on http://www.amazon.co.uk/meter-Professional-Weather-Balloon-1200g/dp/B0061SUOWO
    var weather_balloon = new Balloon(1.065);

    /** Type of object that can be lifted by balloons */
    var ObjectType = (function() {
        var results_template = get_template("#results-section-template");
        var balloon_svg_width_percent = 100.0;

        var cls = function() {
            this.extras_form_template = null;
        };

        /** Update extras form area when this object type is selected */
        cls.prototype.update_extras_form_area = function() {
            $("#extras-form-area").html(this.extras_form_template({}));
        };
        /** Get the radius of this object. Must be inherited */
        cls.prototype.get_radius = function() { };
        /** Get the URL of this object type's SVG file */
        cls.prototype.get_svg_url = function() { };
        /** Set this object type's mass from the form. Must be inherited */
        cls.prototype.set_from_form = function() { };
        /** Update results area showing how many balloons could lift this object! */
        cls.prototype.update_results_section = function() {
            this.set_from_form();
            if (this.mass !== undefined) {
                var num_standard_balloons = standard_balloon.num_balloons(this.mass);
                var num_weather_balloons = weather_balloon.num_balloons(this.mass);
                var thing_radius = this.get_radius();
                var lattice_radius = standard_balloon.lattice_radius(num_standard_balloons);
                var width_percent = (thing_radius / lattice_radius) * 100.0;
                $("#results-section").html(results_template({
                    "num_standard_balloons": num_standard_balloons.toLocaleString(),
                    "lattice_diameter": Math.round(lattice_radius * 2.0),
                    //"num_weather_balloons": num_weather_balloons.toLocaleString(),
                    "balloon_svg_width": percentify(balloon_svg_width_percent),
                    "object_svg_url": this.get_svg_url(),
                    "object_svg_width": percentify(width_percent),
                }));
                var $obj_svg = $(".object-svg");
                // Move the object image to the centre
                $obj_svg.css("margin-left", percentify(50.0 - (width_percent / 2.0)));
                show_results_section();
                // Once the object image is loaded, move it up slightly so it overlaps
                // with the balloon tether
                $obj_svg.on("load", function() {
                    $(this).css("margin-top", -$(this).height() / 13.0);
                    // And move page down to results
                    $(document.body).animate({
                        "scrollTop": $("#results-section").offset().top
                    }, 400);
                    $svgs = $(".svgs");
                    spin_div($svgs, 0, 10, 2000);
                    swing_div($svgs, 10, -10, 4000);
                });
            }
        };
        return cls;
    }());

    /**
     * How many balloons does it take to lift a house?
     * Uses number of floors and bedrooms to estimate the mass of the house
     * This is a singleton
     */
    var house = (function() {
        // Number of kg/m^2 for houses depending on number of floors
        var AREA_DENSITY_PER_NUM_FLOORS = {
            1: 976.49,
            2: 1342.67,
            3: 1708.85
        };
        /** Estimate the area of a house based on the number of bedrooms */
        var get_area = function(num_bedrooms) {
            // This equation found using a linear regression on census data
            return 25.80 * num_bedrooms + 19.94
        };
        var extras_form_template = get_template("#house-form-template");
        // URL for house SVG
        var svg_url = "img/house.svg";

        var cls = function() {
            this.extras_form_template = extras_form_template;
        };
        
        cls.prototype = Object.create(ObjectType.prototype);
        /**
         * Assuming the house is close to a square, its radius will be about the
         * square root of its area (Multiplied by two due to double-width svg)
         */
        cls.prototype.get_radius = function() {
            return (Math.sqrt(this.area) / 2.0) * 2.0;
        };
        /** Get the URL of house SVG file */
        cls.prototype.get_svg_url = function() { return svg_url; };
        /** Set values for this house based on form values */
        cls.prototype.set_from_form = function() {
            var num_floors = parseInt($("#num-floors").val());
            var area_density = AREA_DENSITY_PER_NUM_FLOORS[num_floors];
            if (area_density !== undefined) {
                var num_bedrooms = parseInt($("#num-bedrooms").val());
                this.area = get_area(num_bedrooms);
                this.mass = this.area * area_density;
            } else this.mass = undefined;
        };
        return new cls();
    }());

    /**
     * How many balloons does it take to lift a person?
     * Simply asks the person how much they weigh
     */
    var person = (function() {
        var extras_form_template = get_template("#person-form-template");
        // Well this is my radius (Multiplied by two due to double-width svg)
        var radius = 0.2 * 2.0;
        // URL of person SVG file
        var svg_url = "img/person.svg";
        // Convert units of weight to kilograms, the most superior unit
        var unit_conversions = {
            "kgs": 1.0,
            "lbs": 0.454
        };

        var cls = function() {
            this.extras_form_template = extras_form_template;
        };

        cls.prototype = Object.create(ObjectType.prototype);
        cls.prototype.get_radius = function() { return radius; }
        /** Get the URL of person SVG file */
        cls.prototype.get_svg_url = function() { return svg_url; };
        /** Set person's mass based on form values */
        cls.prototype.set_from_form = function() {
            var rate = unit_conversions[$("#person-weight-units").val()];
            var units = parseFloat($("#person-weight").val());
            if (rate && units) {
                this.mass = rate * units;
            } else this.mass = undefined;
        };
        return new cls();
    }());

    var cur_object_type = null;

    var on_form_submit = function() {
        if (cur_object_type !== null) {
            cur_object_type.update_results_section();
        }
        return false;
    };

    /** Use value selected in what-to-lift selection to change current object type */
    var change_object_type = function() {
        var val = $("#what-to-lift").val();
        switch (val) {
            case "house":
                cur_object_type = house;
            break;
            case "myself":
                cur_object_type = person;
            break;
            default:
                cur_object_type = null;
            break;
        }
        if (cur_object_type !== null) cur_object_type.update_extras_form_area();
        else $("#extras-form-area").html("");
    };

    module.init = function() {
        $("#what-to-lift").change(change_object_type);
        $("#form").submit(on_form_submit);
    };
    return module;
})(jQuery, Handlebars);
