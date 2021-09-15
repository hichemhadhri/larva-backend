const express = require("express");

const router = express.Router();
const mongoose = require('mongoose')
const User = require("../models/user")
const bcrypt = require('bcrypt');
const jwt  = require('jsonwebtoken');
const check_auth = require("../middlewares/check_auth");


//sign up route
router.post("/sign",async (req,res,next)=>  {
    try{
   const existingUsers = await  User.find({mail : req.body.mail}).exec();
   if(existingUsers.length >=1){
      const error = new Error("User with email already exists")
      error.status = 409 ;
      next(error);
   }
   else{
    const  hashedPassword = await bcrypt.hash(req.body.password,10)
    const newUser = new User({
        _id : new mongoose.Types.ObjectId(),
        mail : req.body.mail,
        name : req.body.name,
        surname : req.body.surname,
        password : hashedPassword,
        age : req.body.age,
        sexe : req.body.sexe,
    });
    var user =  await newUser.save()
    var token = await jwt.sign(
       {user : result}
    ,
    process.env.JWT_KEY,{
        expiresIn : "1d"
    }
    );
    return  res.status(200).json({
            user : user,
            token : token
        })
    }   
    }catch(err){
        const error = new Error(err.message)
        error.status = 500 
        next(error)
    }
});

//login route
router.post("/login", async(req,res,next)=>{
    var error;
    try{
        const user  = await User.find({mail: req.body.mail}).exec()
        if(user.length== 0 ) {
            error = new Error("User with email  not found ")
            error.status = 404
            throw error
        } 
            
        const validatePassword = await bcrypt.compare(req.body.password,user[0].password)
        if(validatePassword){
            var token = await jwt.sign(
               {user : user[0]}
            ,
            process.env.JWT_KEY,{
                expiresIn : "1d"
            }
            );
            res.status(200).json({
                user : user[0],
                token : token 
            })
        }else{
            error =  new Error("Password is wrong")
            error.status= 401
            throw error
        }

       

    }catch(err){
        const error = new Error(err.message)
        
        error.status =  err.status
        next(error)
    }


});

router.get("/:id",async (req,res,next)=> {
    try {
    const user = await User.findById(req.params.id).exec();   
    console.log(user.sexe)
    res.status(200).json({
        id : user._id,
        pdp : user.userPdp,
        name : user.name, 
        surname : user.surname, 
        favorites : user.favorites,
        sexe : user.sexe, 
        pubs : user.pubs,
        pubsPhotos : user.pubsPhotos,
        following : user.following,
        followers : user.followers,
        description : user.description
    })
    }catch(err){
        const error = new Error(err.message)
        
        error.status =  err.status
        next(error)
    }

});


module.exports = router ; 