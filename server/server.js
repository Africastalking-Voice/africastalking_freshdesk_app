exports = {
  setConfigData: function(args) {
    // console.log("setConfigData","setConfigData");
  	const iparams           = args.iparams;
    const user_name         = iparams.user_name;
    const api_key           = iparams.api_key;
    const sip_number        = iparams.sip_number;
    const sip_password      = iparams.sip_password;
    const application_url   = 'https://'+iparams.queuer_application_url;
    const phone             = args.phone;

    const sipserver         = sip_number.split('@')[1];

    const configData = {
    	"application_url"   : application_url,
      "sip_number"        : sip_number,
      "sip_password"      : sip_password,
		  "sipserver"         : sipserver
    };

  	$db.set( "africastalking", 
  		{ "configData": configData }
  	).then (
  		function(data) {
  		  console.info("SUCCESS: Config data saved to db.", configData);
  		}
  	)
  }
};


