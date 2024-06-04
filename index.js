// Import Express.js
import express from 'express'
// Import body-parser (to handle parameters more easily)
import bodyParser from 'body-parser'
import * as XLSX from 'xlsx/xlsx.mjs'
import * as fs from 'fs'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import * as dotenv from 'dotenv'


XLSX.set_fs(fs)

// This variable defines the port of your computer where the API will be available
const PORT = 3000

// This variable instantiate the Express.js library
const app = express()

dotenv.config();
app.use( express.json())
// Indicate to Express.js that you're using an additional plugin to treat parameters
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())
// The code below starts the API with these parameters:
// 1 - The PORT where your API will be available
// 2 - The callback function (function to call) when your API is ready
app.listen(PORT, () =>
console.log(`The API is running on: http://localhost:${PORT}.`)
)



//método get de la API que sirve para acondicionar y devolver los datos

app.get('/pacientes', authenticateToken,(request, response ) => {

  const file = XLSX.readFile('./datos.xlsx', { cellDates: true }) //utilizamos la libreria xlsx para poder explotar la informacion, 

  const sheetName = file.Workbook.Sheets[0].name; 
  const sheet = file.Sheets[sheetName]; 
  
  const secciones =  seccionar(XLSX.utils.sheet_to_json(sheet));
  return response.json(secciones);
  
})
//funcion para preparar el array que devolvera la API con los datos de los pacientes
function seccionar(data){
  //para cada linea de datos realizamos la funcion excelAPaciente
  return data.map(line => excelAPaciente(line))
}

//funcion que prepara cada uno de los valores para cada paciente y lo devuelve
function excelAPaciente(paciente) {
  //buscamos el estado en el que se situa el paciente
  const status = getEstadoPaciente(paciente)

  //valores del paciente
  return  {
    "estado": status,
    "paciente": paciente["NUMEROHC"],
    "ubicacion": paciente["HABITACION URG"],
    "ultimaFecha": getFechaPaciente(paciente, status),
    "especialidad": getEspecialidad(paciente, status),
    "cama": getCamaPaciente(paciente, status)
  }
}

//funcion para recoger la especialidad que se asigna al paciente y en el caso en el que se sepa a que unidad va a ingresar tambien se devuelve. 
function getEspecialidad(paciente, status) {
  let especialidad = []
  // estado de solicitud_cama se obvia
  // if (status == "solicitud_cama"){
  //   especialidad = paciente["SERVICIO INGRESO HOS"]
  // } else 
  if (status == "asignacion_cama"){
    especialidad = paciente["SERVICIO INGRESO HOS"]
  } else {
    especialidad = paciente["SERVICIO INGRESO HOS"]+"-"+paciente["UD ENFERMERIA HOS"]
  }
  return especialidad
}

//funcion que nos devuelve la fecha que nos interesa para colocar el contador dependiendo del estado en el que se encuentre el paciente.
function getFechaPaciente(paciente, status) {
  
  if (status == 'alta_enfermeria'){
    return paciente["FECHA INGRESO HOS"]
  } else if (status == 'asignacion_cama'){
    return paciente["FECHA ALTA MEDICA URG"]
  } 
  // estado de solicitud_cama se obvia
  // else if (status == 'solicitud_cama'){
  //   return paciente["FECHA SOLICITUD INGRESO"]
  // } 
  else if (status == 'fin_seguimiento'){
    return paciente["FECHA ALTA URG ENF"]
  } else if (status == 'pendiente_alta_enfermeria'){
    return paciente["FECHA INGRESO HOS ENF"]
  }
  
}
//funcion que devuelve el estado en el que se situa el paciente dependiendo de que fecha tengamos en la base de datos
function getEstadoPaciente (paciente){
  if (paciente["FECHA ALTA URG ENF"] != null) {
    return 'fin_seguimiento'
  } else if (paciente["FECHA INGRESO HOS ENF"] != null) {
    return 'pendiente_alta_enfermeria'
  } else if (paciente["FECHA INGRESO HOS"] != null) {
    return 'alta_enfermeria'
  } 
  // estado de solicitud_cama se obvia
  // else if (paciente["FECHA SOLICITUD INGRESO"] != null){
  //   return 'solicitud_cama'
  // }
   else if(paciente["FECHA ALTA MEDICA URG"]){
    return 'asignacion_cama'
  }

}
//funcion que devuelve la cama en la que va a hospitalizar el paciente en el caso de que este en el estado de alta_enfermeria
  function getCamaPaciente(paciente, status){
    if (status == 'alta_enfermeria' || status == 'pendiente_alta_enfermeria'){
      return paciente["CAMA HOS"]
    } else {
      return null
    }
  }



/////////////////////////

//Esta funcion genera un token JWT para la autentificacion del usuario
function generateAccessToken() {
  return jwt.sign({username:'admin'}, process.env.TOKEN_SECRET);
}

//la funcion que se llama cuando introducimos la contraseña en la aplicacion principal
app.post('/login', (req, res) => {
  // ...

  console.log(req.body)
  //si la contraseña introducida es distinta de la que tenemos en el servidor se manda un error
  if(req.body.password != process.env.ADMIN_PASSWORD){
    return res.sendStatus(401)
  }
  //si es igual entonces se crea el token y se devuelve a la aplicación
  const token = generateAccessToken();
  res.json({accessToken:token});

  // ...
});

//middleware, esto se encarga de verificar que el token es creado por el secreto que conoce la API y no es un token cualquiera
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    console.log(err)

    if (err) return res.sendStatus(403)

    req.user = user

    next()
  })
}


