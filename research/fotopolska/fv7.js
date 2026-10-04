   
    var TD_over;
    var SB_over;
    var int_Sbox;
    var BoxCurrent;
    var lastFraza;
    var lastCo;
    var openedBar;
    var cometScroll;
    var c_settings = false;
    var start = 0;
    var ctrlActive = false;
    var mapCustom = '';
    
    $(document).ready(function(){
        // Menu
        $(".js-enabled > .memu-root").click(function(){
            //$(this).children("ul").fadeIn(300);
            $(this).children("ul").show();
        });
        $(".has-children").mouseenter(function(){
            if(typeof(this.intv) != "undefined"){
                clearTimeout(this.intv);
            }
            var $child = $(this).children("ul");
            //$child.css("left", $(this).position().left + 230);
            $child.css("left", $(this).position().left + 230);
            $child.css("top", $(this).position().top);
            //$child.fadeIn(300);
            $child.show();
            $child.showPanel();
        });
        $(".has-children").mouseleave(function(){
            var $child = $(this).children("ul");
            this.intv = setTimeout(function(){
                //$child.fadeOut(300);
                $child.hide();
            },200);
        });
        $(".memu-root").mouseleave(function(){
           //$(this).children("ul").fadeOut(300);
           $(this).children("ul").hide();
        });
        $(".memu-root > ul").mouseleave(function(){
            //$(this).fadeOut(300);
            $(this).hide();
        });
        
        float_height = $('#Floating').height();
        last = 0;
        
        $(window).resize(function(){
            $(window).scroll();
        });
        
        $(window).scroll(function(){
            if($('#top_div').offset().top-$(document).scrollTop() < 0){
                if(!$('#top_bar').hasClass('Fixed'))
                    $('#top_bar').addClass('Fixed');
            } else if($('#top_div').offset().top-$(document).scrollTop() >= 0){
                if($('#top_bar').hasClass('Fixed'))
                    $('#top_bar').removeClass('Fixed');
            }
            float_height = $('#Floating').height();
            if($('#FloatingRel').height() > $('#Floating').height()){
                if(window.innerHeight < float_height + $('#top_bar').height()){
                    // kolumna nie mieści się na ekranie
                    delta2 = $('#FloatingRel').offset().top+$('#FloatingRel').height() - $(document).scrollTop() - window.innerHeight;  // odległość od dołu strony
                    if(delta2 < 0)
                        bottom = -delta2;
                    else
                        bottom = 0;
                    delta = $('#FloatingRel').offset().top + float_height - $(document).scrollTop() - window.innerHeight;
                    if(delta < 0){
                        $('#Floating').css('position', 'fixed');
                        $('#Floating').css('bottom', bottom+'px');
                        if(last == 2)
                            $('#Floating').css('top','');
                        last = 1;
                    } else {
                        $('#Floating').css('position', 'static');
                    }
                } else {
                    if($('#FloatingRel').offset().top - $('#top_bar').height() - $(document).scrollTop() < 0){
                        $('#Floating').css('position', 'fixed');
                        $('#Floating').css('top', $('#top_bar').height()+'px');
                        if(last == 1)
                            $('#Floating').css('bottom','');
                        last = 2;
                    } else {
                        $('#Floating').css('position', 'static');
                    }
                }
            } else {                
                $('#Floating').css('position', 'static');
            }

            scrollToTopButton();
        });
        
        // Comet
        $("#c_button").click(function(){
            $(this).fadeOut(500);
            $("#c_info").fadeIn(500, function(){
                if(typeof(cometScroll) == "undefined"){
                    $("#c_content").jScrollPane({mouseWheelSpeed:50, contentWidth: "100%"});
                    cometScroll = $("#c_content").data('jsp');
                }
            });
            $.post("/inc/AjaxComet.php",{info: "on"});
        });
        
        $("#c_info_close").click(function(){
            $("#c_info").fadeOut(500);
            $("#c_button").fadeIn(500);
            $.post("/inc/AjaxComet.php",{info: "off"});
        });
        
        $("#c_settings").click(function(){
            comet_Settings();
        });
        
        if(typeof(runComet) != "undefined"){
            cometPobierzKanal();
        }
        
        $(".MainBoxB, #boxRight").mouseenter(function(){
            StopMainBox();
        })
        $(".MainBoxB, #boxRight").mouseleave(function(){
            RunMainBox();
        });
        
        $("#login").focusin(function(){
            $(this).removeAttr("rel");
        });
        $("#login").focusout(function(){
            if($(this).val() == ""){
                $(this).attr("rel","login");
            }
        });
        $("#haslo").focusin(function(){
            $(this).removeAttr("rel");
        });
        $("#haslo").focusout(function(){
            if($(this).val() == ""){
                $(this).attr("rel","haslo");
            }
        });

        var clipboard = new ClipboardJS('#id_obiektu, .CityName');
        var cint;
        clipboard.on('success', function(e) {
            console.info('Action:', e.action+', '+e.text);
            var y = $('#'+e.trigger.id).offset().top + $('#'+e.trigger.id).height();
            var x = $('#'+e.trigger.id).offset().left;
            var btn = '';
            $('#'+e.trigger.id).css('opacity', '0.5');
            $('#minitip').remove();
            if(e.trigger.id === 'id_obiektu'){
                btn = ' <button id="mininip-przypisz" type="button" class="fbtn fbtn-info"><i class="fas fa-pen-alt"></i> przypisz</button>';
            }
            $('body').append(
                '<div id="minitip" style="position:absolute;left:'+x+'px;top:'+y+'px;color:#fff;background-color:#555;padding:5px;border-radius:5px">' +
                    '<span style="font-size:13px">Skopiowano do schowka <strong>'+e.text+'</strong></span>'+btn+
                '</div>'
            );
            $('#minitip').mouseleave(function(){
                cint = setTimeout(function(){
                    $('#minitip').fadeOut(500, function(){
                        $(this).remove();
                    });
                }, 1500);
            });
            $('#minitip').mouseenter(function(){
                clearTimeout(cint);
            });
            if(user) {
                sendWebSocket('clipboard_'+user, {user: user, typ: 'object_id', value: e.text});
                $('#mininip-przypisz').click(function(){
                    sendWebSocket('clipboard_'+user, {user: user, typ: 'object_id', value: e.text, assign:true});
                });
            }
        });

        /*var keypressed;

        $('body').on('keydown', function(e){
            keypressed = e.which;
        });

        $('body').on('keyup', function(){
            keypressed = null;
        });*/

        window.onmessage = m => {
            if(m.data.source === 'map') {
                mapCustom = m.data.custom;
            }
        };

        scrollToTopButton();

        $('.scroll-to-top').click(function() {
            if ($(this).hasClass('off')) {
                return;
            }
            $('html, body').animate({
                scrollTop: 0
            }, 300);
        });
    });

    function sendWebSocket(channel, data){
        wsc = new WebSocket("wss://fotopolska.eu/get/" + channel);
        wsc.onopen = function(){
            wsc.send(JSON.stringify(data).replace(/"/g, "\\\""));
        };
    }
    
    function NoweZdjecia(){
        $("#NewPhoto").slideUp(500, function(){
            $("#NewPhoto").load("/klasyn/AjaxNoweZdjecia.php", {typ:NZdoTyp, id:NZdo, filtr:$("input[type='radio'][name='nzc']:checked").val(), start: start, typZdjec: typZdjec}, function(){
                nadajPreview();
                $("#NewPhoto").slideDown(500);
            });
        });
    }
    
    function hideM(obj){
        alert(obj);
    }
    
    function RunMainBox(){
        intBox = setInterval("AutoMainBox()", 3000);
    }
    
    function StopMainBox(){
        clearInterval(intBox);
    }
    
    function AutoMainBox(){
        currentIndex = mbArray.lastIndexOf(BoxCurrent) + 1;
        if(currentIndex + 1 >= mbArray.length)
            currentIndex = 0;
        MainBox(mbArray[currentIndex]);
    }
    
    function nadajNoweZdjecia(){
        $("[name='nzx']").change(function(){
            url = $("#urlTyp").val();
            url = url.replace("[TYP]", $("[name='nzx']:checked").val());
            window.location = url;
        });
    }
    
    var ALop = Array;
    var NZdoTyp, NZdo;
    
    function AjaxLista(tryb, options, prefix){
        if(!prefix)
            index = 1;
        else
            index = 2;
        
        // Otwieramy nowe zdjęcia jeśli jesteśmy w nowych zdjęciach    
        if(options.dzieckoId && tryb == "NoweZdjecia"){
            $("#NewPhoto").slideUp(500, function(){
                $("#NewPhoto").load("/klasyn/AjaxNoweZdjecia.php", {typ:options.dzieckoTyp, id:options.dzieckoId, filtr:$("input[type='radio'][name='nzc']:checked").val()}, function(){
                    nadajPreview();
                    ALop[index] = options.rodzicTyp + options.dzieckoId;
                    $("#NewPhoto").slideDown();
                    if(options.dzieckoId){
                        NZdoTyp = options.dzieckoTyp;
                        NZdo    = options.dzieckoId;
                    }
                });
            });
        }
        if(ALop[index] === options.idx && prefix != 'z'){
            $("#l"+prefix+"_" + ALop[index]).slideUp(500);
            ALop[index] = null;
        } else {
            if(tryb == "selective"){
                if(ALop[index] && ALop[index] != options.idx){
                    $("#l"+prefix+"_" + ALop[index]).slideUp(500);
                }
                if($("#l"+prefix+"_" + options.idx).attr("rel") != "loaded"){
                    $("#l"+prefix+"_" + options.idx).load("/klasyn/AjaxLista.php", {tryb: tryb, rodzic_typ: options.rodzicTyp, rodzic_id:options.rodzicId, dziecko_typ:options.dzieckoTyp, dziecko_id:options.dzieckoId, prefix: prefix, idx: options.idx}, function(){
                        $("#l"+prefix+"_" + options.idx).attr("rel","loaded");
                        $("#l"+prefix+"_" + options.idx).slideDown(500, function(){
                            if(options.dzieckoTyp == "p" || options.dzieckoTyp == "m"){
                                $("#l"+prefix+"_" + ALop[index]).jScrollPane({mouseWheelSpeed:50, contentWidth: "100%", maintainPosition:false});
                            }
                        });
                        ALop[index] = options.idx;
                    });
                } else {
                    ALop[index] = options.idx;
                    $("#l"+prefix+"_" + options.idx).slideDown(500);
                }
            } else {
                //$()
                idx = parseInt(options.idx)+1;
                //alert("#ctn"+prefix+"_" + idx);
                //alert($("#ctn"+prefix+"_"+idx).length);
                $("#ctn"+prefix+"_"+idx).slideUp(500);
                $("#l"+prefix+"_" + options.idx).slideUp(500, function(){
                    
                    if($("#ctn"+prefix+"_"+idx).length == 0){
                        $("#ctn"+prefix+"_"+options.idx).append("<div id='ctn"+prefix+"_"+idx+"'></div>");
                    }
                    $.post("/klasyn/AjaxLista.php", {tryb: tryb, rodzic_typ: options.rodzicTyp, rodzic_id: options.rodzicId, dziecko_typ: options.rodzicTyp, dziecko_id: options.dzieckoId, prefix: prefix, idx: options.idx}, function(result){
                        $("#ctn"+prefix+"_" + idx).replaceWith(result); 
                        $("#ctn"+prefix+"_" + idx).hide();
                        $("#ctn"+prefix+"_" + idx).slideDown(500, function(){
                            $(".siz100").jScrollPane({mouseWheelSpeed:50, contentWidth: "100%"});                        
                        });
                    });
                });
            }
        }
    }
    
    function TypyObiektow(typ){
        $("#TwoFrame").load("/klasyn/AjaxObiekty.php", {typ:typ, miasto:miasto}, function(){
            $("#TwoFrame").slideDown(500);
            $("#DownFrame").hide();
            NadajMiniatury();
        })
    }
    
    function NadajMiniatury(){
        $(".Miniatura, .MiniaturaBox").unbind("mouseenter");
        $(".Miniatura, .MiniaturaBox").unbind("mouseleave");
        $(".Miniatura, .MiniaturaBox").mouseenter(function(){
            if($(this).hasClass('MiniaturaNoAni')){
                return;
            }
            if($(this).hasClass('MiniaturaAni')) {
                $(this).css('background-size', $(this).attr('data-hw')+'px '+$(this).attr('data-hh')+'px');
            } else {
                $(this).attr("animating", "yes");
                //$(this).animate({opacity:0}, 100, function(){
                $(this).css("background-size", "contain");
                /*  $(this).animate({opacity:1}, 100, function(){
                      $(this).attr("animating", "no");
                      if($(this).attr("hide") == "yes"){
                          $(this).removeAttr("hide");
                          HideMini($(this));
                      }
                  });
              });*/
            }
        });
        $(".Miniatura, .MiniaturaBox").mouseleave(function(){
            if($(this).hasClass('MiniaturaNoAni')){
                return;
            }
            if($(this).hasClass('MiniaturaAni')) {
                $(this).css('background-size', $(this).attr('data-w')+'px '+$(this).attr('data-h')+'px');
            } else {
                /* if($(this).attr("animating") == "yes"){
                     $(this).attr("hide", "yes");
                 } else {*/
                HideMini($(this));
                //}
            }
        });
    }
    
    function HideMini(mini){
        //mini.css("opacity","0");
        mini.css("background-size","cover");
        //mini.animate({opacity:1});
    }
    
    function MainBox(foto){
        if(foto != BoxCurrent){
            current = BoxCurrent;
            BoxCurrent = foto;
            $("#boxFoto_"+current).fadeOut(500);
            $("#boxInfo_"+current).fadeOut(500);
            $("#mc_"+current).removeClass("Active");
            $("#rb_"+current).removeClass("RboxActive");
            $("#boxFoto_"+foto).fadeIn(500);
            $("#boxInfo_"+foto).fadeIn(500);
            $("#mc_"+foto).addClass("Active");
            $("#rb_"+foto).addClass("RboxActive");
        }
        //alert(foto+", "+BoxCurrent);
    }
    
    function animuj(obiekt, value){
        obiekt.animate({opacity: value},500, function(){
            if(obiekt.css("opacity") == 1){
                animuj(obiekt, 0);
            } else {
                animuj(obiekt, 1);
            }
        });
    }

	jQuery.fn.prettyCheckboxes = function(settings) {
		settings = jQuery.extend({
					checkboxWidth: 12,
					checkboxHeight: 13,
					className : 'prettyCheckbox',
					display: 'list'
				}, settings);

		$(this).each(function(){
			// Find the label
			$label = $('label[for="'+$(this).attr('id')+'"]');

			// Add the checkbox holder to the label
			$label.prepend("<span class='holderWrap'><span class='holder'></span></span>");

			// If the checkbox is checked, display it as checked
			if($(this).is(':checked')) { $label.addClass('checked'); };

			// Assign the class on the label
			$label.addClass(settings.className).addClass($(this).attr('type')).addClass(settings.display);

			// Assign the dimensions to the checkbox display
			$label.find('span.holderWrap').width(settings.checkboxWidth).height(settings.checkboxHeight);
			$label.find('span.holder').width(settings.checkboxWidth);

			// Hide the checkbox
			$(this).addClass('hiddenCheckbox');

			// Associate the click event
			$label.bind('click',function(){
            
				$('input#' + $(this).attr('for')).triggerHandler('click');
				
				if($('input#' + $(this).attr('for')).is(':checkbox')){
					$(this).toggleClass('checked');
					$('input#' + $(this).attr('for')).checked = true;
					
					$(this).find('span.holder').css('top',0);
				}else{
					$toCheck = $('input#' + $(this).attr('for'));

					// Uncheck all radio
					$('input[name="'+$toCheck.attr('name')+'"]').each(function(){
                        if($(this).attr("id") != $toCheck.attr("id")){
                            $("#b_"+$(this).attr("id")).animate({"background-position-y":"25px"}, 500, function(){
                                $("#b_"+$(this).attr("id")).removeClass('Bright');
                            });
                        }
						$('label[for="' + $(this).attr('id')+'"]').removeClass('checked');	
					});

					$(this).addClass('checked');
                    $("#b_"+$toCheck.attr("id")).addClass('Bright');
                    $("#b_"+$toCheck.attr("id")).css("background-position-y","25px");
                    $("#b_"+$toCheck.attr("id")).animate({"background-position-y":"0px"},{duration:500});
					$toCheck.checked = true;
				};
			});
			
			$('input#' + $label.attr('for')).bind('keypress',function(e){
				if(e.keyCode == 32){
					if($.browser.msie){
						$('label[for="'+$(this).attr('id')+'"]').toggleClass("checked");
					}else{
						$(this).trigger('click');
					}
					return false;
				};
			});
		});
	};
	
	checkAllPrettyCheckboxes = function(caller, container){
		if($(caller).is(':checked')){
			// Find the label corresponding to each checkbox and click it
			$(container).find('input[type=checkbox]:not(:checked)').each(function(){
				$('label[for="'+$(this).attr('id')+'"]').trigger('click');
				if($.browser.msie){
					$(this).attr('checked','checked');
				}else{
					$(this).trigger('click');
				};
			});
		}else{
			$(container).find('input[type=checkbox]:checked').each(function(){
				$('label[for="'+$(this).attr('id')+'"]').trigger('click');
				if($.browser.msie){
					$(this).attr('checked','');
				}else{
					$(this).trigger('click');
				};
			});
		};
	};
    
    function goTo(url){
        window.location = url;
    }
    
    function actionPreview(){
        $("body").mousemove(function(e){
            newX = e.pageX + 15;
            newY = e.pageY + 15;
            if(newX + $("#newPhoto").width() > $(window).width() - 10){
                newX = $(window).width() - 10 - $("#newPhoto").width();
            }
            $("#newPhoto").css("top", newY);
            $("#newPhoto").css("left", newX);
        });
    }
    
    function nadajPreview(){
        actionPreview();
        
        $(".nfL").mouseenter(function(){
            mouseOff = false;
            changeMini($(this).attr("rel"), typZdjec);
        });
        $(".nfL").mouseleave(function(){
            mouseOff = true;
            hidePreview();
        });
        $(document).keydown(function(e){
            if(e.keyCode == 17){
                ctrlActive = true;
            }
        });
        $(document).keyup(function(e){
            if(e.keyCode == 17){
                ctrlActive = false;
            }
        });
        $(".nfL").click(function(e){
            e.preventDefault();
            if(e.which == 2 || ctrlActive){
                window.open($(this).attr("href"), "_blank");
                $(this).children().css("opacity","0.5");
            } else {
                window.location = $(this).attr("href");
            }
        });
    }
    
    function changeMini(id, typZdjec){
        $("#newPhoto").fadeOut(200, function(){
            $("#newPhoto").load("/klasyn/AjaxZdjeciePreview.php?f="+id+"&typZdjec="+typZdjec, function(){
                if(!mouseOff){
                    $("#newPhoto").fadeIn(200);
                }
            });
        });
    }
    
    function showPreview(){
        $("#newPhoto").fadeIn(200);
    }
    
    function hidePreview(){
        $("#newPhoto").fadeOut(200);
    }
    
    function comet_Settings(){
        $("#c_settings_panel").slideToggle(500);
        if(!c_settings){
            c_settings = true;
            $("[name='comet_votes'],[name='comet_comment'],[name='comet_replies']").change(function(){
                $.post("/inc/AjaxComet.php",{param: $(this).attr('name'), setting: $(this).val()});
                cometSettings[$(this).attr('name')] = $(this).val();
                $("#c_content").html("Wczytywanie danych...");
                $("#c_content").load("/inc/AjaxComet.php",{getData: 'yes'});
            });
        }
    }
    
    var ws;
    
    function cometPobierzKanal(){
        
        console.log('createSocket');
        ws = new WebSocket("wss://fotopolska.eu/get/channel_1");
        ws.onmessage = function (event) {
            data = JSON.parse(event.data);
            d = getUrlVars(data.text);
            //console.log(d);
            //console.log(data.text);
            //console.log(user);
            var allow = false;
            if(cometSettings.comet_votes == "yes" && d["typ"] == "glos" && d["sendTo"] == user) allow = true;
            if(cometSettings.comet_replies == "yes" && d["typ"] == "komentarz_odpowiedz" && d["sendTo"] == user) allow = true;
            if(cometSettings.comet_comment == "yes" && d["typ"] == "komentarz_zdjecia" && d["kto"] != user) allow = true;
            if(cometSettings.id_obiektucomet_comment == "my" && d["typ"] == "komentarz_zdjecia" && d["kto"] != user && d["user"] == user) allow = true;
             //console.log(allow);
            if(allow == true){
                $.get("/klasyn/ClassComet.php?idc="+d["id"], function(data){
                    dtx = $("#c_content .jspPane").prepend(data).find("[id^='cm']").first();
                    if($("#c_info").css("display") == "none"){
                        $("#c_button").effect("pulsate", { times:3 }, 1000);
                    }
                    $('.lazy', dtx).lazy();
                    cometScroll.reinitialise();
                    openBar(dtx.attr("id"));
                });
            }
        }
        
        return;
        comet = $.ajax({url: "/get/channel_1", type: "GET", beforeSend: function(xhr){
            if(typeof(lastModified) != "undefined")
                xhr.setRequestHeader("If-Modified-Since", lastModified);
            if(typeof(etag) != "undefined")
                xhr.setRequestHeader("If-None-Match", etag);
        },
        success: function(data, ts, xhr){
            lm   = xhr.getResponseHeader("Last-Modified");
            etag = xhr.getResponseHeader("Etag");
            if(lm) lastModified = lm;
            d = getUrlVars(data);
            var allow = false;
            if(cometSettings.comet_votes == "yes" && d["typ"] == "glos" && d["sendTo"] == user) allow = true;
            if(cometSettings.comet_replies == "yes" && d["typ"] == "komentarz_odpowiedz" && d["sendTo"] == user) allow = true;
            if(cometSettings.comet_comment == "yes" && d["typ"] == "komentarz_zdjecia" && d["kto"] != user) allow = true;
            if(cometSettings.comet_comment == "my" && d["typ"] == "komentarz_zdjecia" && d["kto"] != user && d["user"] == user) allow = true;
            
            if(allow == true){
                $.get("/klasyn/ClassComet.php?idc="+d["id"], function(data){
                    dtx = $("#c_content .jspPane").prepend(data).find("[id^='cm']").first();
                    if($("#c_info").css("display") == "none"){
                        $("#c_button").effect("pulsate", { times:3 }, 1000);
                    }
                    cometScroll.reinitialise();
                    openBar(dtx.attr("id"));
                });
            }
            cometPobierzKanal();
        }});
    }
    
    function openBar(id){
        if(openedBar != id){
            $("#"+openedBar).slideUp(500);
            $("#"+id).slideDown(500, function(){
                cometScroll.reinitialise()
            });
            openedBar = id;
        } else {
            $("#"+id).slideUp(500, function(){
                cometScroll.reinitialise()
            });
            openedBar = null;
        }
    }
    
    function getUrlVars(url){
        var vars = [], hash;
        var hashes = url.split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = decodeURIComponent(hash[1]);
        }
        return vars;
    }

    (function( jQuery ) {
        var matched,
            userAgent = navigator.userAgent || "";

        // Use of jQuery.browser is frowned upon.
        // More details: http://api.jquery.com/jQuery.browser
        // jQuery.uaMatch maintained for back-compat
        jQuery.uaMatch = function( ua ) {
            ua = ua.toLowerCase();

            var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
                /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
                /(opera)(?:.*version)?[ \/]([\w.]+)/.exec( ua ) ||
                /(msie) ([\w.]+)/.exec( ua ) ||
                ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+))?/.exec( ua ) ||
                [];

            return {
                browser: match[ 1 ] || "",
                version: match[ 2 ] || "0"
            };
        };

        matched = jQuery.uaMatch( userAgent );

        jQuery.browser = {};

        if ( matched.browser ) {
            jQuery.browser[ matched.browser ] = true;
            jQuery.browser.version = matched.version;
        }

        // Deprecated, use jQuery.browser.webkit instead
        // Maintained for back-compat only
        if ( jQuery.browser.webkit ) {
            jQuery.browser.safari = true;
        }

    }( jQuery ));

    /*! jquery-iframe-auto-height - v2.0.0
     *  Release on: 2015-06-28iframeAutoHeight
     *  Copyright (c) 2015 Jesse House
     *  Licensed The Unlicense */
    (function ($) {
        $.fn.iframeAutoHeight = function (spec) {

            var undef;
            if ($.browser === undef) {
                var message = [];
                message.push("WARNING: you appear to be using a newer version of jquery which does not support the $.browser variable.");
                message.push("The jQuery iframe auto height plugin relies heavly on the $.browser features.");
                message.push("Install jquery-browser: https://raw.github.com/house9/jquery-iframe-auto-height/master/release/jquery.browser.js");
                alert(message.join("\n"));
                return $;
            }

            // set default option values
            var options = $.extend({
                heightOffset: 0,
                minHeight: 0,
                maxHeight: 0,
                callback: function () {},
                animate: false,
                debug: false,
                diagnostics: false, // used for development only
                resetToMinHeight: false,
                triggerFunctions: [],
                heightCalculationOverrides: []
            }, spec);

            // logging
            function debug(message) {
                if (options.debug && options.debug === true && window.console) {
                    console.log(message);
                }
            }

            // not used by production code
            function showDiagnostics(iframe, calledFrom) {
                debug("Diagnostics from '" + calledFrom + "'");
                try {
                    debug("  " + $(iframe, window.parent).contents().find('body')[0].scrollHeight + " for ...find('body')[0].scrollHeight");
                    debug("  " + $(iframe.contentWindow.document).height() + " for ...contentWindow.document).height()");
                    debug("  " + $(iframe.contentWindow.document.body).height() + " for ...contentWindow.document.body).height()");
                } catch (ex) {
                    // ie fails when called during for each, ok later on
                    // probably not an issue if called in a document ready block
                    debug("  unable to check in this state");
                }
                debug("End diagnostics -> results vary by browser and when diagnostics are requested");
            }

            // show all option values
            debug(options);

            // ******************************************************
            // iterate over the matched elements passed to the plugin ; return will make it chainable
            return this.each(function () {

                // ******************************************************
                // http://api.jquery.com/jQuery.browser/
                var strategyKeys = ['webkit', 'mozilla', 'msie', 'opera', 'chrome'];
                var strategies = {};
                strategies['default'] = function (iframe, $iframeBody, options) {
                    // NOTE: this is how the plugin determines the iframe height, override if you need custom
                    return $iframeBody[0].scrollHeight + options.heightOffset;
                };

                jQuery.each(strategyKeys, function (index, value) {
                    // use the default strategy for all browsers, can be overridden if desired
                    strategies[value] = strategies['default'];
                });

                // override strategies if registered in options
                jQuery.each(options.heightCalculationOverrides, function (index, value) {
                    strategies[value.browser] = value.calculation;
                });

                function findStrategy(browser) {
                    var strategy = null;

                    jQuery.each(strategyKeys, function (index, value) {
                        if (browser[value]) {
                            strategy = strategies[value];
                            return false;
                        }
                    });

                    if (strategy === null) {
                        strategy = strategies['default'];
                    }

                    return strategy;
                }
                // ******************************************************

                // for use by webkit only
                var loadCounter = 0;

                var iframeDoc = this.contentDocument || this.contentWindow.document;

                // resizeHeight
                function resizeHeight(iframe) {
                    if (options.diagnostics) {
                        showDiagnostics(iframe, "resizeHeight");
                    }

                    // set the iframe size to minHeight so it'll get smaller on resizes in FF and IE
                    if (options.resetToMinHeight && options.resetToMinHeight === true) {
                        iframe.style.height = options.minHeight + 'px';
                    }

                    // get the iframe body height and set inline style to that plus a little
                    var $body = $(iframe, window.parent).contents().find('body');
                    var strategy = findStrategy($.browser);
                    var newHeight = strategy(iframe, $body, options, $.browser);
                    debug(newHeight);

                    if (newHeight < options.minHeight) {
                        debug("new height is less than minHeight");
                        newHeight = options.minHeight;
                    }

                    if (options.maxHeight > 0 && newHeight > options.maxHeight) {
                        debug("new height is greater than maxHeight");
                        newHeight = options.maxHeight;
                    }

                    newHeight += options.heightOffset;

                    debug("New Height: " + newHeight);
                    if (options.animate) {
                        $(iframe).animate({height: newHeight + 'px'}, {duration: 500});
                    } else {
                        iframe.style.height = newHeight + 'px';
                    }

                    options.callback.apply($(iframe), [{newFrameHeight: newHeight}]);
                } // END resizeHeight

                // debug me
                debug(this);
                if (options.diagnostics) {
                    showDiagnostics(this, "each iframe");
                }

                // if trigger functions are registered, invoke them
                if (options.triggerFunctions.length > 0) {
                    debug(options.triggerFunctions.length + " trigger Functions");
                    for (var i = 0; i < options.triggerFunctions.length; i++) {
                        options.triggerFunctions[i](resizeHeight, this);
                    }
                }

                // Check if browser is Webkit (Safari/Chrome) or Opera
                if ($.browser.webkit || $.browser.opera || $.browser.chrome) {
                    debug("browser is webkit (Safari/Chrome) or opera");

                    // Start timer when loaded.
                    $(this).on('load', function () {
                        var delay = 0;
                        var iframe = this;

                        var delayedResize = function () {
                            resizeHeight(iframe);
                        };

                        if (loadCounter === 0) {
                            // delay the first one
                            delay = 500;
                        } else {
                            // Reset iframe height to 0 to force new frame size to fit window properly
                            // this is only an issue when going from large to small iframe, not executed on page load
                            iframe.style.height = options.minHeight + 'px';
                        }

                        debug("load delay: " + delay);
                        setTimeout(delayedResize, delay);
                        loadCounter++;
                    });

                    // Safari and Opera need a kick-start.
                    var source = $(this).attr('src');
                    $(this).attr('src', '');
                    $(this).attr('src', source);
                } else {
                    // For other browsers.
                    if(iframeDoc.readyState  === 'complete') {
                        resizeHeight(this);
                    } else {
                        $(this).on('load', function () {
                            resizeHeight(this);
                        });
                    }
                } // if browser

            }); // $(this).each(function () {
        }; // $.fn.iframeAutoHeight = function (options) {
    }(jQuery)); // (function ($) {
// Autogrow

(function ($) {
    $.fn.autogrow = function () {
        this.filter('textarea').each(function () {
            var $this = $(this),
                minHeight = $this.height(),
                shadow = $('<div></div>').css({
                    position:   'absolute',
                    top: -10000,
                    left: -10000,
                    width: $(this).width(),
                    fontSize: $this.css('fontSize'),
                    fontFamily: $this.css('fontFamily'),
                    lineHeight: $this.css('lineHeight'),
                    resize: 'none'
                }).addClass('shadow').appendTo(document.body),
                update = function () {
                    var t = this;
                    setTimeout(function () {
                        var val = t.value.replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/&/g, '&amp;')
                                .replace(/\n/g, '<br/>&nbsp;');
    
                        if ($.trim(val) === '') {
                            val = 'a';
                        }
    
                        shadow.html(val);
                        $(t).css('height', Math.max(shadow[0].offsetHeight + 20, minHeight));
                    }, 0);
                };

            $this.change(update).keyup(update).keydown(update).focus(update);
            update.apply(this);
        });

        return this;
    };

}(jQuery));

// End Autogrow

function forumPreview(forum_id){
    $("#newPhoto").load("/klasyn/AjaxForum.php?forum="+forum_id);
}

function tryb_edycji(onoff){
    document.location = '/test.php?modul=Ustawienia&parametr_1=tryb_kopiowania&wartosc_1='+onoff+'&url_powrotu='+encodeURIComponent(document.location);
    event.stopPropagation();
}

function tryb_ukryte(onoff){
    document.location = '/test.php?modul=Ustawienia&parametr_1=tryb_ukryte&wartosc_1='+onoff+'&url_powrotu='+encodeURIComponent(document.location);
    event.stopPropagation();
}

function edytujMape(str){
    $('#dodaj_zdjecie').html('<iframe src="/Mapa.php?m=e&height=600&'+str+'&auto_idob='+$('#id_obiektu').html()+'" style="width:892px;height:650px;border:0px;" scrolling="no"></iframe>')
}

function edytujMapeOSM(str){
    $('#dodaj_zdjecie').html('<iframe src="/klasyn/MapaOSM.php?edit=1&height=673&'+str+'&auto_idob='+$('#id_obiektu').html()+'" style="width:100%;height:723px;border:0px;" scrolling="no"></iframe>')
}

function mapaFullScreen(center, zoom, k) {
    $('body').append(
        '<div id="mapFs" style="position:fixed;left:0;right:0;bottom:0;top:0;z-index:500;width:100%;height:100%">' +
            '<button onclick="$(\'#mapFs\').remove()" style="cursor:pointer;border:0;position:absolute;right:189px;top:12px;z-index:10;padding: 0.25rem 0.5rem;font-size: 0.875rem;line-height: 1.5;border-radius: 0.2rem;color: #fff;background-color: #6c757d;border-color: #6c757d;"><i class="fas fa-compress-arrows-alt"></i> Zamknij pełny ekran</button>' +
            '<iframe frameborder="0" style="position:absolute;left:0;right:0;bottom:0;top:0;z-index:1;width:100%;height:100%" src="/klasyn/MapaOSM.php?lat=('+center.lat+','+center.lng+')&zoom='+zoom+'&k='+k+'&mod=i&wdw=full&custom=' + mapCustom + '">mapfs</iframe>' +
        '</div>'
    );
}

let sctState = 'off';

function scrollToTopButton() {
    if ($(document).scrollTop() >= 250 && sctState === 'off') {
        $('.scroll-to-top').removeClass('off').addClass('on');
        sctState = 'on';
    } else if ($(document).scrollTop() < 250 && sctState === 'on') {
        $('.scroll-to-top').removeClass('on').addClass('off');
        sctState = 'off';
    }
}
