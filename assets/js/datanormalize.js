var data = {};

var scene, camera, renderer;

init();

//read data from csv and analyse it
function init() {
    d3.csv("../assets/data/all_gestures_scores1.csv", function(d) {
        data[d.Timestamp] = d;
    }, function(error, rows) {
        parse(data);
        normalize(data);
        loadData(data);
        //exportData(data);
    });
}

function exportData(d) {
    data = [];

    for (var e in d) {
        entry = [+d[e].Gesture, d[e].sphere_position.x, d[e].sphere_position.y,
                    d[e].sphere_position.z, d[e].sphere_radius, d[e].fingers.length];

        for (var i = 0; i < 5; i++) {
            if (i < d[e].fingers.length) {
                var f = d[e].fingers[i];
                entry.push(f.tip.x, f.tip.y, f.tip.z, f.direction.x, f.direction.y, f.direction.z);
            } else {
                entry.push(0, 0, 0, 0, 0, 0);
            }
        }

        for (var i = 0; i < 4; i++)
            for (var j = i + 1; j < 5; j++)
                if (i < d[e].fingers.length && j < d[e].fingers.length) {
                    var dist = d[e].fingers[i].tip.distanceToSquared(d[e].fingers[j].tip);
                    var ang  = d[e].fingers[i].direction.angleTo(d[e].fingers[j].direction);
                    entry.push(dist, ang);
                } else {
                    entry.push(0, 0);
                }

        data.push(entry);
    }

    dumpToCSV(data);
}

function dumpToCSV(data) {
    var csvContent = "data:text/csv;charset=utf-8,";
    data.forEach(function(infoArray, index){

        dataString = infoArray.join(",");
        csvContent += index < infoArray.length ? dataString+ "\n" : dataString;

    });

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "all_data_plus.csv");

    link.click();
}

function parse(d) {
    for (var e in d) {
        //parse hand position and orientation
        d[e].position = new THREE.Vector3(  +d[e].Hand_position_x,
                                            +d[e].Hand_position_y,
                                            +d[e].Hand_position_z);
        delete d[e].Hand_position_x;
        delete d[e].Hand_position_y;
        delete d[e].Hand_position_z;

        d[e].pitch  = +d[e]["Hand_pitch"];
        d[e].yaw    = +d[e]["Hand_yaw"];
        d[e].roll   = +d[e]["Hand_roll"];

        delete d[e]["Hand_pitch"];
        delete d[e]["Hand_yaw"];
        delete d[e]["Hand_roll"];

        //parse hand sphere position and radius
        d[e].sphere_position = new THREE.Vector3(   +d[e].Hand_sphere_x,
                                                    +d[e].Hand_sphere_y,
                                                    +d[e].Hand_sphere_z);
        delete d[e].Hand_sphere_x;
        delete d[e].Hand_sphere_y;
        delete d[e].Hand_sphere_z;

        d[e].sphere_radius = +d[e].Hand_sphere_r;

        delete d[e].Hand_sphere_r;

        //parse finger data into array of tip and directions objects
        var fingers = [];

        for(var i = 0; i < 5; i++) {
            //record only valid finger data
            if (d[e]["finger"+i+"_tip_x"] != '') {
                var finger = {}

                finger.tip = new THREE.Vector3( +d[e]["finger"+i+"_tip_x"],
                                                +d[e]["finger"+i+"_tip_y"],
                                                +d[e]["finger"+i+"_tip_z"]);

                finger.direction = new THREE.Vector3(   +d[e]["finger"+i+"_direction_x"],
                                                        +d[e]["finger"+i+"_direction_y"],
                                                        +d[e]["finger"+i+"_direction_z"]);
                fingers.push(finger);
            }

            delete d[e]["finger"+i+"_tip_y"];
            delete d[e]["finger"+i+"_tip_x"];
            delete d[e]["finger"+i+"_tip_z"];
            delete d[e]["finger"+i+"_direction_x"];
            delete d[e]["finger"+i+"_direction_y"];
            delete d[e]["finger"+i+"_direction_z"];
        }

        d[e].fingers = fingers;

    }
}

function normalize(d) {
    for (var e in d) {
        translate(d[e]);
        rotate(d[e]);
        rearrange(d[e]);
    }
}

function rearrange(d) {
    do {
        var swapped = false;

        for (var i = 1; i < d.fingers.length; i++) {
            if (d.fingers[i-1].tip.x > d.fingers[i].tip.x) {
                var temp        = d.fingers[i-1];
                d.fingers[i-1]  = d.fingers[i];
                d.fingers[i]    = temp;

                swapped = true;
            }
        }
    } while (swapped);
}

/*
    Rotate entire hand such that the palm's pitch, roll and yaw are 0
 */
function rotate(d) {
    //define the 3 axes
    var X = new THREE.Vector3(1,0,0);
    var Y = new THREE.Vector3(0,1,0);
    var Z = new THREE.Vector3(0,0,1);

    //rotate sphere position
    d.sphere_position.applyAxisAngle(X, -d.pitch);
    d.sphere_position.applyAxisAngle(Y,  d.yaw);
    d.sphere_position.applyAxisAngle(Z, -d.roll);

    //rotate each finger
    for (var i = 0; i < d.fingers.length; i++) {
        d.fingers[i].tip.applyAxisAngle(X, -d.pitch);
        d.fingers[i].tip.applyAxisAngle(Y,  d.yaw);
        d.fingers[i].tip.applyAxisAngle(Z, -d.roll);

        d.fingers[i].direction.applyAxisAngle(X, -d.pitch);
        d.fingers[i].direction.applyAxisAngle(Y,  d.yaw);
        d.fingers[i].direction.applyAxisAngle(Z, -d.roll);
    }

    //rotate hand position
    d.pitch = 0;
    d.yaw   = 0;
    d.roll  = 0;
}

/*
    Translate entire hand such that the palm position is at the origin
 */
function translate(d) {
    //translate sphere position
    d.sphere_position.sub(d.position);

    //translate each finger
    for (var i = 0; i < d.fingers.length; i++)
        d.fingers[i].tip.sub(d.position);

    //translate palm position
    d.position.sub(d.position);
}

/*
    Display all information in the form, image and 3d scene
 */
function loadData(d) {
    //load all data entries in the dropdown, select by keys (timpestamp + gesture)
    var select = document.getElementById("gesture");

    for (var e in d) {
        var el = document.createElement("option");
        el.textContent = Object.keys(d).indexOf(d[e].Timestamp) + " " + d[e].Timestamp + " " + d[e].Gesture;
        el.value = e;
        select.appendChild(el);
    }

    //load all the data for one entry when it is selected in the dropdown
    $( "#gesture" ).change(function() {
        gesture = (d[this.value] != undefined) ? d[this.value].Gesture : '';
        document.getElementById("gesture-image").innerHTML = (gesture.length == 0) ?
            "No gesture selected!" : "<img src=../assets/img/gesture" + gesture + "R_snapshot.png>";
        if (d[this.value] != undefined) {
            draw(d[this.value]);
            document.getElementById('canvas-container').innerHTML = (renderer == undefined) ?
                'If you are not already doing it, please use the Google Chrome browser' : '';
            document.getElementById("canvas-container").appendChild(renderer.domElement);
            displayHandInfo(d[this.value]);
            displayFingersInfo(d[this.value]);
        };
    });
}

/*
    Display hand information in form
 */
function displayHandInfo(d) {
    document.getElementById('Score_knn').value     = +d.Score_knn;
    document.getElementById('Score_svm').value     = +d.Score_svm;
    document.getElementById('Score_knn+').value    = +d.Score_knn_plus;
    document.getElementById('Score_svm+').value    = +d.Score_svm_plus;
    document.getElementById('hn.pos.x').value      = d.position.x;
    document.getElementById('hn.pos.y').value      = d.position.y;
    document.getElementById('hn.pos.z').value      = d.position.z;

    document.getElementById('hn.pitch').value      = d.pitch;
    document.getElementById('hn.yaw').value        = d.yaw;
    document.getElementById('hn.roll').value       = d.roll;

    document.getElementById('hn.sphere.x').value   = d.sphere_position.x;
    document.getElementById('hn.sphere.y').value   = d.sphere_position.y;
    document.getElementById('hn.sphere.z').value   = d.sphere_position.z;
    document.getElementById('hn.sphere.r').value   = d.sphere_radius;
}

/*
    Display finger information in form
 */
function displayFingersInfo(d) {
    for (var i = 0; i < d.fingers.length; i++) {
        document.getElementById('fg' + i + '.direction.x').value = d.fingers[i].direction.x;
        document.getElementById('fg' + i + '.direction.y').value = d.fingers[i].direction.y;
        document.getElementById('fg' + i + '.direction.z').value = d.fingers[i].direction.z;

        document.getElementById('fg' + i + '.tip.x').value       = d.fingers[i].tip.x;
        document.getElementById('fg' + i + '.tip.y').value       = d.fingers[i].tip.y;
        document.getElementById('fg' + i + '.tip.z').value       = d.fingers[i].tip.z;
    }
}

var draw = function(d){
    scene = new THREE.Scene();
    var width = document.getElementById("canvas-container").offsetWidth;
    window.addEventListener('resize', resizeCanvas, false);
    camera = new THREE.PerspectiveCamera(45, width/400, 0.10, 1000);
    renderer = new THREE.WebGLRenderer();
    resizeCanvas();

    camera.position.z = 10;
    camera.position.y = 400;

    camera.lookAt(new THREE.Vector3(0,100,-50));

    var circle;
    var radius   = 60,
        segments = 64,
        material = new THREE.LineBasicMaterial( { color: 0x0000aa , linewidth: 5} ),
        geometry = new THREE.CircleGeometry( radius, segments );

    circle = new THREE.Line( geometry, material );
    circle.position = d.position;
    circle.rotation.set(d.pitch - Math.PI/2, -d.roll, -d.yaw + Math.PI/2);

    scene.add(circle);

    for (var i = 0; i < d.fingers.length; i++) {
        var finger = new THREE.ArrowHelper(d.fingers[i].direction, d.fingers[i].tip, 40, undefined,undefined,10);
        finger.line.material = new THREE.LineBasicMaterial( { color: colors[i]   , linewidth: 5} );
        finger.setColor(colors[i]);

        finger.position = d.fingers[i].tip;
        finger.setDirection(d.fingers[i].direction);

        scene.add(finger);
    }

    renderer.render(scene, camera);
}

function resizeCanvas() {
    var width = document.getElementById("canvas-container").offsetWidth;
    camera.aspect = width/400;
    camera.updateProjectionMatrix();
    renderer.setSize(width, 400);

    renderer.render(scene,camera);
}

var colors = [0xFFFFFF, 0xFFCCCC, 0xFF8080, 0xFF4D4D, 0xFF0000];