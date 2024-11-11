<?php
header("Content-Type: text/plain");
echo file_get_contents('config/initial_prompt.ini');
?>