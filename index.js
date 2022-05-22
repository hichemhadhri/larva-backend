const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const port = 3000
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");


const usersRoute = require("./api/routes/users")
const postsRoute = require("./api/routes/posts")
const contestsRoute = require("./api/routes/contests")
const checkAuth = require('./api/middlewares/check_auth');



mongoose.connect("mongodb+srv://hichem:"+ process.env.MONGO_PW +"@larva0.n0sjk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",{
    useUnifiedTopology : true,
    useNewUrlParser : true,
    useFindAndModify: false,
    useCreateIndex: true
})



app.use(morgan("dev"));

//Parse the request body
app.use(bodyParser.json())


//CORS handling
app.use((req,res,next)=>{
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","Origin, X-Requested-With,Content-Type,Accept,Authorization");
    if(req.method == "OPTIONS"){
        res.header("Access-Control-Allow-Methods", "PUT , POST , GET ,PATCH , DELETE");
        return res.status(200).json({});
    }

    next();
})



//Routes to handle requests
app.use("/users",usersRoute)
app.use("/posts",postsRoute)
app.use("/contests",contestsRoute)


//serve FILES
app.get("/:media", (req, res) => {
    res.sendFile(path.join(__dirname, "./uploads/"+req.params.media));
  });

//check Login 
app.get("/",checkAuth,(req,res,next)=>{
    res.status(200).json({
        message : "Connected Successfully"
    });
})

//Invalid route 
app.use((req,res,next)=> {
    const error = new Error("Not Found")
    error.status = 404 ;
    next(error)
})

//Error handling
app.use((error,req,res,next)=>{
    res.status(error.status || 500).json({
        error : {
            message : error.message
        }
    })
})

app.listen(process.env.PORT || 3000)