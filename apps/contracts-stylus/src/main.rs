#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(feature = "export-abi")]
fn main() {
    paraape_risk_engine::print_from_args();
}
