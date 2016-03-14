# -*- mode: ruby -*-
# vi: set ft=ruby :

$provision = <<SCRIPT

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y sudo nodejs nodejs-legacy mongodb npm git build-essential
npm install -g bower typescript
export DEBIAN_FRONTEND=dialog

# Configure locales
export LANGUAGE=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
locale-gen en_US.UTF-8
dpkg-reconfigure locales

# Add the environment type if not set
if [ -z ${SF_ENVIRONMENT} ]
  then
    echo "SF_ENVIRONMENT=development" | tee -a /etc/environment
fi

# Install and compile project dependencies
cd /vagrant
npm install --production --no-bin-links
cp /vagrant/node_modules/libxmljs/build/Release/lib.target/xmljs.node /vagrant/node_modules/libxmljs/build/
export NODE_ENV=development
node index.js -i
#node index.js -t
node index.js

#
# Done! Happy coding!
#

SCRIPT

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.network "forwarded_port", guest: 80, host: 8080
  config.vm.provision "shell", inline: $provision
end
