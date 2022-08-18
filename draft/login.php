<?php
   $email = $_POST['email'];
   $password = $_POST['pass'];
   
   $conn = new mysqli("localhost","root","","clubhouse");
   if($conn->connect_error){
      echo($conn);
      die("failed to connect:".$conn->connect_error);
   }
   else{
      $stmt=$conn->prepare("select * from user where email = ?");
      $stmt->bind_param("s",$email);
      $stmt->execute();
      $stmt_result = $stmt->get_result();
      if($stmt_result->num_rows >0){
         $data =$stmt_result->fetch_assoc();
         if($data['password']===$password){
            header("location: homepage_user.html");
         }
         else{
            echo "invalid email or password";
         }
      }
      else
      {
         echo "invalid email";
      }
   }
?>