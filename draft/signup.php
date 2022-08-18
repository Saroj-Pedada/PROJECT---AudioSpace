<?php 
    $name=$_POST["name"];
    $email=$_POST["email"];
    $pass=$_POST["pass"];
    
    $conn= new mysqli('localhost','root','',"clubhouse");

    if($conn){

        $stmt = $conn->prepare("INSERT INTO user (name, email, password) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $name, $email, $pass);
        $stmt->execute();
        $stmt->close();
        $conn->close();
        header("location: homepage_user.html");
    }
    else {
       die('connection failed:'.$conn->connect_error);
      }
    
?>