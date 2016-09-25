//(C)2016 Edwin Eefting - edwin@datux.nl

//wait until emscripten is ready:
Module={};
Module['onRuntimeInitialized']=function()
{

    //wait until document is ready:
    $( document ).ready( function()
    {

        function status_ok(txt)
        {
            $("#status_bar").text(txt).removeClass("status_error status_processing").addClass("status_ok");
        }

        function status_processing(txt)
        {
            $("#status_bar").text(txt).removeClass("status_error status_ok").addClass("status_processing");
        }

        function status_error(txt)
        {
            $("#status_bar").text(txt).removeClass("status_processing status_ok").addClass("status_error");
        }


        function load_settings()
        {
            var settings_json=localStorage.getItem("settings");
            if (settings_json)
            {
                settings=JSON.parse(settings_json);
            }
            else
            {
                settings=
                {
                    rows: 1,
                    cols: 160,
                    auto_send: true,
                }
            }

            $("#program_name").val(settings.program_name);
            $("#settings_rows").val(settings.rows);
            $("#settings_cols").val(settings.cols);

            //load last editor contents from localstorage
            if (localStorage.hasOwnProperty("current_program"))
            {
                editor.setValue(localStorage.getItem("current_program"),1);
            }

        }

        function save_settings()
        {
            var cols=$("#settings_cols").val();
            var rows=$("#settings_rows").val();

            if (cols * rows > Module.MAX_LEDS)
            {
                status_error("Total number of leds cannot be more than "+Module.MAX_LEDS);
            }
            else if ( cols < 10 )
            {
                status_error("Colums should be greater than 10");
            }
            else if ( rows < 1 )
            {
                status_error("Rows should be at least 1");
            }
            else
            {
                localStorage.setItem("current_program", editor.getValue());

                settings.rows=rows;
                settings.cols=cols;
                settings.program_name=$("#program_name").val();

                localStorage.setItem("settings", JSON.stringify(settings));
                status_ok("settings saved");
                return(true);
            }
            return(false);
        }


        //strip_animator class and command array
        var strip_anim=new Module.strip_anim_c();
        var MAX_LEDS=Module.MAX_LEDS;
        animation_id=0;

        // start ledstrip simulator via canvas
        function init_canvas()
        {

            /////////////////////////////////// prepare canvas

            //fast pixel manipulation code borrowed from http://jsfiddle.net/andrewjbaker/Fnx2w/
            var canvas = document.getElementById('ledsim');
            var canvasWidth  = canvas.width;
            var canvasHeight = canvas.height;
            canvas_context = canvas.getContext('2d');
            image_data = canvas_context.getImageData(0, 0, canvasWidth, canvasHeight);

            var image_buf = new ArrayBuffer(image_data.data.length);
            image_buf8 = new Uint8ClampedArray(image_buf);
            image_data32 = new Uint32Array(image_buf);

            // Determine whether Uint32 is little- or big-endian.
            image_data32[1] = 0x0a0b0c0d;

            is_little_endian = true;
            if (image_buf[4] === 0x0a && image_buf[5] === 0x0b && image_buf[6] === 0x0c && image_buf[7] === 0x0d)
            {
                is_little_endian = false;
            }


        }


        /// animate one step and update canvas
        function step()
        {
            animation_id=requestAnimationFrame(step);
            strip_anim.step();


            var rgb;
            if (is_little_endian)
            {
                //optimized a bit to make loop cheaper
                for (var l=0;l<led.leds;l++)
                {
                    rgb=strip_anim.get_led(l);
                    image_data32[l] =
                    (255   << 24) |    // alpha
                    (rgb.b << 16) |    // blue
                    (rgb.g <<  8) |    // green
                    rgb.r;            // red
                }
            }
            else
            {
                for (var l=0;l<led.leds;l++)
                {
                    image_data32[l] =
                    (rgb.r << 24) |    // red
                    (rgb.g << 16) |    // green
                    (rgb.b <<  8) |    // blue
                    255;              // alpha
                }
            }

            image_data.data.set(image_buf8);
            canvas_context.putImageData(image_data, 0, 0);
        }


        //get current program from editor and compile it
        // var last_program="";
        function compile_editor(editor)
        {
            if (animation_id)
            {
                cancelAnimationFrame(animation_id);
            }
            save_settings();


            try
            {
                status_processing("Compiling program...");
                led.clear_commmands();
                eval(editor.getValue());
                error="";
            }
            catch(e)
            {
                error=String(e);
            }

            if (error)
            {
                status_error(error);
            }
            else
            {
                status_ok("Compiled ok, "+led.commands.size()+" bytes.");
                strip_anim.set_commands(led.commands);
                step();
            }
        }

        //download a string as a textfile
        //from http://stackoverflow.com/questions/3665115/create-a-file-in-memory-for-user-to-download-not-through-server
        function download(filename, data) {
            var blob = new Blob([data], {type: 'text/plain'});
            if(window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveBlob(blob, filename);
            }
            else{
                var elem = window.document.createElement('a');
                elem.href = window.URL.createObjectURL(blob);
                elem.download = filename;
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
            }
        }


        //clones specified jquery element template
        function clone_template(element)
        {
            var clone=element.clone();
            clone.removeClass("template");
            clone.insertAfter(element);
            return(clone);
        }


        function update_local_animation_list()
        {
            $(".local_animation:not(.template)").remove();

            $.each(Object.keys(localStorage), function(nr, key)
            {
                if (key.match("^program "))
                {
                    var clone=clone_template($(".local_animation.template"))
                    var animation_name=key.replace(/^program /, "");
                    $(".local_animation_name", clone).text(animation_name);
                    $(".local_animation_click", clone).data("animation_name", animation_name);
                }
            });

        }


        function update_animation_list(url, repo)
        {
            for(category in repo)
            {
                var category_element=clone_template($(".category.template"));
                $(".category_title", category_element).text(category);

                for(animation in repo[category])
                {
                    var animation_element=clone_template($(".animation.template", category_element));
                    $(".animation_name", animation_element).text(animation);
                    $(".animation_desc", animation_element).text(repo[category][animation]);
                    $(".animation_click", animation_element).data("url", url+category+"/"+animation);
                    $(".animation_click", animation_element).data("animation", animation);
                    $(".animation_click", animation_element).data("category", category);
                }
            }
        }

        function load_animation_repo(url)
        {
            var index_url=url+"index.json";
            status_processing("Downloading animation list...");

            $.ajax(index_url, {
                dataType: "json",
                error: function(xhr, status, text)
                {
                    status_error("Error while loading "+index_url+": "+ text);
                },
                // succces:
            }).done(function(data)
            {
                update_animation_list(url, data);
                status_ok("Animation list downloaded");
            });
        }


        var timeout;
        function delayed(func)
        {
            clearTimeout(timeout);
            timeout = setTimeout(func, 300);
        }


        //// INITIALISATION


        ///jquery ui stuff
        $("button").button();


        //ace editor
        var editor = ace.edit("editor");
        editor.setTheme("ace/theme/twilight");
        editor.getSession().setMode("ace/mode/javascript");
        editor.$blockScrolling = Infinity;

        load_settings();


        led.leds=settings.rows * settings.cols;
        $("#ledsim").attr("height", settings.rows);
        $("#ledsim").attr("width", settings.cols);

        //make sure pixels are square by setting height
        function scale_canvas()
        {
            css_width=$("#ledsim").width();
            $("#ledsim").css("height",  css_width*settings.rows/settings.cols );
        }
        $(window).resize(function()
        {
            scale_canvas();
        });
        scale_canvas();


        strip_anim.set_used_leds(led.leds);

        update_local_animation_list();

        init_canvas();

        compile_editor(editor);

        load_animation_repo("https://raw.githubusercontent.com/psy0rz/ledanim/master/web/repo/");

        //create tabs. ace editor needs extra attention
        $("#tabs").tabs({
            activate : function(event, ui) {
                if ($("a",ui.newTab).attr("href")=="#tab-edit")
                {
                    console.log("jo");
                    editor.resize();
                    editor.focus();

                }

            }
        });


        ////EVENT change led config
        $("#settings_update").on("click", function() {
            if (save_settings())
            {
                document.location.reload();

            }
        });

        ////EVENT when user changes the program, recompile and save it after a short delay
        editor.on("change", function() {
            delayed(function() {
                compile_editor(editor);
            });
            return false;
        });




        ///EVENT download button
        $("#download").click(function(){
            download($("#program_name").val()+".js", editor.getValue());
            return false;
        });

        ///EVENT save button
        $("#save").click(function(){
            if ($("#program_name").val())
            {
                localStorage.setItem("program "+settings.program_name, editor.getValue());
                update_local_animation_list();
                save_settings();
                status_ok("program saved");
            }
            return false;
        });


        ///EVENT local load button
        $("body").on("click", ".local_animation_click", function()
        {
            var animation_name=$(this).data("animation_name");
            editor.setValue(localStorage.getItem("program "+animation_name),1);
            $("#program_name").val(animation_name);
            return false;
        });

        ///EVENT local delete
        $("#delete").click(function()
        {
            localStorage.removeItem("program "+$("#program_name").val());
            update_local_animation_list();
            status_ok("local animation deleted");
            return false;
        });


        //EVENT user clicked an animation to load
        $("#tab-animations").on("click", ".animation_click", function(e)
        {
            var clicked=$(this);
            var url=clicked.data("url");
            status_processing("Downloading animation "+url);

            $.ajax(url,
                {
                    dataType: "text",
                    error: function(xhr, status, text)
                    {
                        status_error("Error while loading "+url+": "+ text);
                    },
                    // succces:
                }).done(function(data)
                {
                    status_ok("Download of animation ok");
                    $("#program_name").val(clicked.data("animation"));
                    editor.setValue(data,1);
                });


            })

            return false;
        });

    };
