import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Text "mo:base/Text";

actor {

    let users = HashMap.HashMap<Text, Text>(16, Text.equal, Text.hash);
    stable var cls : Text = "";

    public func chat(name : Text) : async Text {
        return "Hi there, " # name # "!";
    };

    public func storeid(proton_account : Text, ic_id : Text) : async Text {
        
        users.put(proton_account, ic_id);

        let numusers = users.size();

        return ic_id # " and " # proton_account # ", number of users = " # Nat.toText(numusers);
    };

    public func storecls(proton_cls : Text) : async Text {
        cls := proton_cls;

        return cls;
    };

     public func getcls() : async Text {
        return cls;
    };
    
};
