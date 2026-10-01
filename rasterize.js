/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var colorBuffer; // this contains vertex colors in triples, one per vertex
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // where to put color for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var colorArray = []; // 1D array of vertex colors for WebGL
        var indexArray = []; // 1D array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices already added, across all sets

        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {

            // set up the vertex coord array, and give every vertex in this set
            // the set's diffuse material color
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
                colorArray = colorArray.concat(inputTriangles[whichSet].material.diffuse);
                // console.log(inputTriangles[whichSet].vertices[whichSetVert]);
            }

            // set up the triangle index array, offset by vertices already added
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++){
                var tri = inputTriangles[whichSet].triangles[whichSetTri];
                indexArray.push(tri[0]+vtxBufferSize, tri[1]+vtxBufferSize, tri[2]+vtxBufferSize);
            }

            // update the vertex offset for the next set
            vtxBufferSize += inputTriangles[whichSet].vertices.length;
        } // end for each triangle set
        // console.log(coordArray.length);
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the vertex colors to webGL
        colorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(colorArray),gl.STATIC_DRAW); // colors to that buffer

        // send the triangle indices to webGL
        triBufferSize = indexArray.length; // remember the size for later rendering
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // required: fragment shaders have no default float precision
        varying vec3 fragColor; // interpolated color from the vertex shader

        void main(void) {
            gl_FragColor = vec4(fragColor, 1.0); // use the interpolated vertex color
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying vec3 fragColor; // color to pass on to the fragment shader

        void main(void) {
            fragColor = vertexColor; // pass the vertex color along
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                vertexColorAttrib = // get pointer to vertex shader color input
                    gl.getAttribLocation(shaderProgram, "vertexColor");
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // activate
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,0,0); // feed

    // triangle index buffer: activate
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate

    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
} // end render triangles


//code for part 5, matt! disclaimer: I used claude to help work through the logic, plan geometry like the beard, etc
function addVertex(scene, x, y, z, r, g, b) { //helper for adding a vertex to the scene based on given coords and colors
    scene.coords.push(x, y, z); //push the given coords
    scene.colors.push(r, g, b); //then the colors
    return scene.coords.length / 3 - 1; // return the index of the vertex we just added
}

function addTri(scene, a, b, c) { //helper for adding a triangle given three indicies of verticies
    scene.indices.push(a, b, c);
}

//helper that builds a triangle fan from a list of outline points (pts)
//since the center vertex and rim have different colors, WebGL blends them across each triangle
//but if no cRim is provided, it just defaults to a flat color
//z sets the depth layer, with smaller z drawn up front
function addFan(s, pts, z, cCenter, cRim) {
    cRim = cRim || cCenter; //if no cRim provided, set it to the center color (flat)

    var cx = 0, cy = 0; //hold the center coords of the fan
    pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); //which are calculated by the average of the outline points
    cx /= pts.length; cy /= pts.length;
    var center = addVertex(s, cx, cy, z, cCenter[0], cCenter[1], cCenter[2]); //add a vertex at the center

    var ids = pts.map(function (p) {
        return addVertex(s, p[0], p[1], z, cRim[0], cRim[1], cRim[2]); //and also at each outline point, all with the rim color
    });
    for (var i = 0; i < ids.length; i++) //go in a circle adding a triangle to each outline edge between the center, point, and next point
        addTri(s, center, ids[i], ids[(i + 1) % ids.length]); //looping back w the modulo to close it all up
}

// returns n number of points evenly spaced around an ellipse centered at the coords with given radii
function ellipsePts(cx, cy, rx, ry, n) {
    var pts = [];
    for (var i = 0; i < n; i++) { //for n
        var a = 2 * Math.PI * i / n; //the angle (in rads) we're at in the circle. stops right before 2pi
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); //use some trig to get the point
        //cos is x offset and sin is y offset, both scaled by their radius components
    }
    return pts;
}

// like ellipsePts except for the egg shape of matt's head
// width varies with height (like an egg)
// because of how sin is positive on the top half and negative on the bottom, 
// the squeeze widens the top area (forehead) and narrows the bottom
// which is how miis look, or at least this mii head shape in particular
function eggPts(cx, cy, rx, ry, n) {
    var pts = [];
    for (var i = 0; i < n; i++) { //for the number of requested points
        var a = 2 * Math.PI * i / n; //again get the angle needed in radians
        var squeeze = 1 + 0.12 * Math.sin(a);  //sin will scale the squeeze factor w height to get the egg shape. 
        //the strength of the squeeze is the .12 here, with lower values resulting in a more ellipsoid shape
        pts.push([cx + rx * Math.cos(a) * squeeze, cy + ry * Math.sin(a)]);
    }
    return pts;
}

// helper for creating a thick strip along a path 
// for eyebrows, mouth, etc
// width is vertical only so steep slants look thinner
function addStrip(s, path, width, z, c) {
    var ids = []; //for holding the vertex indices of each path point
    path.forEach(function (p) { //for each point in the path, add two vertices width apart from each other (half above + half below)
        var top = addVertex(s, p[0], p[1] + width / 2, z, c[0], c[1], c[2]);
        var bot = addVertex(s, p[0], p[1] - width / 2, z, c[0], c[1], c[2]);
        ids.push([top, bot]);
    });
    for (var i = 0; i < ids.length - 1; i++) { //then add two triangles (quad) between the neighboring points to get the visual fill
        addTri(s, ids[i][0], ids[i][1], ids[i + 1][1]);
        addTri(s, ids[i][0], ids[i + 1][1], ids[i + 1][0]);
    }
}

// send the scene to the GPU's buffers for drawing
function uploadScene(scene) {
    vertexBuffer = gl.createBuffer(); //we make an empty buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); //bind it to vertex data 
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scene.coords), gl.STATIC_DRAW); //fill the bound buffer with the vertex data

    colorBuffer = gl.createBuffer(); //same for the vertex colors, make the buffer, bind, fill
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scene.colors), gl.STATIC_DRAW);

    triBufferSize = scene.indices.length; //once again for for triangle indices. also hold onto count for renderTriangles later
    triangleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); //we use an element array buffer since we're holding indicies this time
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(scene.indices), gl.STATIC_DRAW); //16bit indices must match unsigned short type, so largest index is 65535
}

//where we construct matt using all the helper methods and whatnot.
//it's not 1 to 1, but i'd say he looks pretty similar, no?
//layering is done using z coords, so the call order doesn't really matter here
function buildMattScene() {
    var s = { coords: [], colors: [], indices: [] };
    var SKIN_C = [0.80, 0.44, 0.26], SKIN_R = [0.55, 0.27, 0.15]; //colors of center and rim of head gradient to make it look shaded
    var BLACK = [0.05, 0.03, 0.03], WHITE = [1, 1, 1]; //the shades of black and white to be used for things like the goatee and background
    var ORANGE = [1.0, 0.55, 0.10]; //as well as his signature orange shirt color

    // background (farthest in the back so we use z .95)
    addFan(s, [[-1,-1],[1,-1],[1,1],[-1,1]], 0.95, WHITE);

    // shirt is just a wide ellipse, the bottom of it just isn't shown since it's off camera
    addFan(s, ellipsePts(0, -1.0, 0.85, 0.5, 40), 0.7, ORANGE, [0.85, 0.40, 0.05]);

    // head (egg shaped)
    addFan(s, eggPts(0, 0.10, 0.56, 0.66, 48), 0.5, SKIN_C, SKIN_R);

    // nose (lighter in the middle so it looks rounded)
    addFan(s, ellipsePts(0, -0.08, 0.09, 0.10, 20), 0.4, [0.88, 0.52, 0.34], [0.62, 0.31, 0.18]);

    // goatee is a jagged polygon. not an exact match but visually interesting and similar enough
    addFan(s, [
        [-0.28,-0.22],[-0.30,-0.35],[-0.24,-0.45],[-0.18,-0.40],[-0.12,-0.52],
        [-0.06,-0.44],[ 0.00,-0.54],[ 0.06,-0.44],[ 0.12,-0.52],[ 0.18,-0.40],
        [ 0.24,-0.45],[ 0.30,-0.35],[ 0.28,-0.22],[ 0.15,-0.20],[ 0.00,-0.18],
        [-0.15,-0.20]
    ], 0.3, BLACK);

    // mouth is a bunch of points along a downward-curving arc
    var mouth = [];
    for (var i = 0; i <= 10; i++) {
        var x = -0.14 + 0.28 * i / 10, t = x / 0.14;
        mouth.push([x, -0.32 + 0.06 * (1 - t * t)]);   // center high, corners low
    }
    addStrip(s, mouth, 0.03, 0.2, [0.50, 0.25, 0.15]);

    // eyes have a black outline (slightly larger), white, then pupil, each closer so the z decreases
    [-0.21, 0.21].forEach(function (ex) {
        addFan(s, ellipsePts(ex, 0.13, 0.155, 0.095, 24), 0.35, BLACK);
        addFan(s, ellipsePts(ex, 0.12, 0.125, 0.072, 24), 0.30, WHITE);
        addFan(s, ellipsePts(ex, 0.12, 0.05, 0.05, 16), 0.25, BLACK);
    });

    // eyebrows slanting down toward the middle
    addStrip(s, [[-0.40, 0.33], [-0.08, 0.23]], 0.07, 0.25, BLACK);
    addStrip(s, [[ 0.08, 0.23], [ 0.40, 0.33]], 0.07, 0.25, BLACK);

    uploadScene(s); //push it to the gpu buffers so it can be drawn after
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL

  document.addEventListener("keydown", function (e) { //spawn matt
    if( e.code === "Space"){
        e.preventDefault();
        buildMattScene();
        renderTriangles();
    }
  });
  
} // end main
